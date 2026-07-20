"""
Atlas Backend – Runner API

Handles workflow execution requests, streams progress via Server-Sent Events (SSE).
"""

import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from loguru import logger

from storage.database import get_session, ExecutionRecord, WorkflowRecord
from core.workflow_engine import WorkflowEngine

router = APIRouter()

# In-memory registry of running engines (for cancellation)
_running_engines: dict = {}


class RunRequest(BaseModel):
    workflow_id: str
    inputs: dict = {}


class CancelRequest(BaseModel):
    execution_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run")
async def run_workflow(req: RunRequest, session: Session = Depends(get_session)):
    """
    Start a workflow execution.
    Returns an execution_id and streams progress via /run/stream/{execution_id}.
    """
    # Load workflow definition from disk
    from pathlib import Path
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from api.workflows import load_workflow_file

    record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == req.workflow_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Workflow '{req.workflow_id}' not found.")

    wf_def = load_workflow_file(record.file_path)
    if not wf_def:
        raise HTTPException(status_code=500, detail="Could not load workflow definition file.")

    execution_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # Create execution record
    exec_record = ExecutionRecord(
        execution_id=execution_id,
        workflow_id=req.workflow_id,
        workflow_name=record.name,
        status="pending",
        triggered_by="user",
        inputs_json=json.dumps(req.inputs),
        steps_total=len(wf_def.get("steps", [])),
        created_at=now,
    )
    session.add(exec_record)

    # Update workflow stats
    record.run_count += 1
    record.last_run_at = now
    session.add(record)
    session.commit()

    logger.info(f"Execution {execution_id} created for workflow {req.workflow_id}")
    return {"execution_id": execution_id, "status": "pending"}


@router.get("/stream/{execution_id}")
async def stream_execution(execution_id: str, session: Session = Depends(get_session)):
    """
    Server-Sent Events (SSE) stream for real-time workflow progress.
    The React frontend connects to this and updates the chat/progress panel.
    """
    exec_record = session.exec(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    ).first()
    if not exec_record:
        raise HTTPException(status_code=404, detail="Execution not found.")

    from api.workflows import load_workflow_file
    from pathlib import Path

    wf_record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == exec_record.workflow_id)
    ).first()
    wf_def = load_workflow_file(wf_record.file_path) if wf_record else {}
    inputs = json.loads(exec_record.inputs_json or "{}")

    async def event_generator():
        engine = WorkflowEngine(session)
        _running_engines[execution_id] = engine

        # Update status to running
        exec_record.status = "running"
        exec_record.started_at = datetime.utcnow()
        session.add(exec_record)
        session.commit()

        try:
            async for event in engine.execute(wf_def, inputs, execution_id):
                data = json.dumps(event)
                yield f"data: {data}\n\n"

                # Update execution record on terminal events
                if event["type"] == "execution_completed":
                    exec_record.status = "completed"
                    exec_record.completed_at = datetime.utcnow()
                    exec_record.steps_completed = event["data"].get("steps_completed", 0)
                    exec_record.outputs_json = json.dumps(event["data"].get("outputs", {}))
                    if exec_record.started_at:
                        delta = (exec_record.completed_at - exec_record.started_at).total_seconds()
                        exec_record.duration_seconds = delta
                    session.add(exec_record)
                    session.commit()

                elif event["type"] == "execution_failed":
                    exec_record.status = "failed"
                    exec_record.completed_at = datetime.utcnow()
                    exec_record.error_message = event["data"].get("error", "Unknown error")
                    session.add(exec_record)
                    session.commit()

                elif event["type"] == "cancelled":
                    exec_record.status = "cancelled"
                    exec_record.completed_at = datetime.utcnow()
                    session.add(exec_record)
                    session.commit()

        except Exception as e:
            error_event = {
                "type": "execution_failed",
                "message": str(e),
                "data": {"error": str(e)},
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            yield f"data: {json.dumps(error_event)}\n\n"
            exec_record.status = "failed"
            exec_record.error_message = str(e)
            session.add(exec_record)
            session.commit()
        finally:
            _running_engines.pop(execution_id, None)
            yield "data: {\"type\": \"stream_end\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/cancel")
async def cancel_execution(req: CancelRequest):
    """Cancel a running workflow execution."""
    engine = _running_engines.get(req.execution_id)
    if engine:
        engine.cancel()
        return {"ok": True, "message": "Cancellation signal sent."}
    return {"ok": False, "message": "Execution not found or already finished."}


@router.get("/status/{execution_id}")
def get_execution_status(execution_id: str, session: Session = Depends(get_session)):
    """Get the current status of an execution."""
    record = session.exec(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Execution not found.")
    return {
        "execution_id": record.execution_id,
        "workflow_id": record.workflow_id,
        "workflow_name": record.workflow_name,
        "status": record.status,
        "steps_total": record.steps_total,
        "steps_completed": record.steps_completed,
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
        "duration_seconds": record.duration_seconds,
        "error_message": record.error_message,
    }


@router.post("/upload-batch")
async def upload_batch_file(file: UploadFile = File(...)):
    """Upload an Excel/CSV file to be used as batch input for a workflow loop."""
    from pathlib import Path
    import shutil

    # Ensure upload directory exists
    upload_dir = Path(__file__).parent.parent.parent / "data" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Secure the filename
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in (".", "-", "_")).strip()
    if not safe_filename:
        safe_filename = f"upload_{uuid.uuid4().hex[:8]}"
    
    file_path = upload_dir / f"{uuid.uuid4().hex[:8]}_{safe_filename}"

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Batch file uploaded to {file_path}")
        return {"ok": True, "file_path": str(file_path)}
    except Exception as exc:
        logger.error(f"Failed to save uploaded file: {exc}")
        raise HTTPException(status_code=500, detail=f"Could not save file: {exc}")
