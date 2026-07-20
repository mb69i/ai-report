"""Atlas Backend – Workflows API Router"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select
from loguru import logger

from storage.database import get_session, WorkflowRecord

router = APIRouter()
WORKFLOWS_DIR = Path(__file__).parent.parent.parent / "workflows"


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkflowCreateRequest(BaseModel):
    name: str
    description: str = ""
    tags: List[str] = []
    steps: List[dict] = []
    required_inputs: List[dict] = []
    output: dict = {}
    validation: dict = {}


class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    steps: Optional[List[dict]] = None
    required_inputs: Optional[List[dict]] = None
    output: Optional[dict] = None
    validation: Optional[dict] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_workflow_file(file_path: str) -> dict:
    """Load a workflow JSON file from disk."""
    path = Path(file_path)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_workflow_file(workflow_id: str, data: dict) -> str:
    """Save workflow JSON to disk. Returns file path."""
    WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = WORKFLOWS_DIR / f"{workflow_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return str(file_path)


def sync_workflows_from_disk(session: Session) -> None:
    """
    Scan the workflows/ directory and ensure all JSON files
    have corresponding DB records (for first-run imports).
    """
    if not WORKFLOWS_DIR.exists():
        return
    for wf_file in WORKFLOWS_DIR.glob("*.json"):
        try:
            data = json.loads(wf_file.read_text(encoding="utf-8"))
            wf_id = data.get("id", wf_file.stem)
            existing = session.exec(
                select(WorkflowRecord).where(WorkflowRecord.workflow_id == wf_id)
            ).first()
            if not existing:
                record = WorkflowRecord(
                    workflow_id=wf_id,
                    name=data.get("name", wf_id),
                    description=data.get("description", ""),
                    version=data.get("version", "1.0.0"),
                    tags=json.dumps(data.get("tags", [])),
                    file_path=str(wf_file),
                )
                session.add(record)
                session.commit()
                logger.info(f"Imported workflow from disk: {wf_id}")
        except Exception as e:
            logger.warning(f"Failed to import workflow {wf_file}: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_workflows(session: Session = Depends(get_session)):
    """Return all active workflows with their full JSON definitions."""
    sync_workflows_from_disk(session)
    records = session.exec(
        select(WorkflowRecord)
        .where(WorkflowRecord.is_active == True)
        .where(WorkflowRecord.is_archived == False)
    ).all()

    result = []
    for r in records:
        wf_data = load_workflow_file(r.file_path)
        result.append({
            "id": r.workflow_id,
            "db_id": r.id,
            "name": r.name,
            "description": r.description,
            "version": r.version,
            "tags": json.loads(r.tags or "[]"),
            "run_count": r.run_count,
            "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
            "created_at": r.created_at.isoformat(),
            "modified_at": r.modified_at.isoformat(),
            "required_inputs": wf_data.get("required_inputs", []),
            "steps_count": len(wf_data.get("steps", [])),
            "output_format": wf_data.get("output", {}).get("format", "excel"),
        })
    return result


@router.get("/{workflow_id}")
def get_workflow(workflow_id: str, session: Session = Depends(get_session)):
    """Get full workflow definition by ID."""
    record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == workflow_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    wf_data = load_workflow_file(record.file_path)
    return {
        "db_record": record,
        "definition": wf_data,
    }


@router.post("/")
def create_workflow(req: WorkflowCreateRequest, session: Session = Depends(get_session)):
    """Create a new workflow from the Training Mode."""
    wf_id = req.name.lower().replace(" ", "_").replace("-", "_")
    wf_id = f"{wf_id}_{uuid.uuid4().hex[:6]}"

    now = datetime.utcnow().isoformat() + "Z"
    definition = {
        "id": wf_id,
        "name": req.name,
        "description": req.description,
        "version": "1.0.0",
        "created_at": now,
        "modified_at": now,
        "tags": req.tags,
        "required_inputs": req.required_inputs,
        "steps": req.steps,
        "output": req.output,
        "validation": req.validation,
    }

    file_path = save_workflow_file(wf_id, definition)

    record = WorkflowRecord(
        workflow_id=wf_id,
        name=req.name,
        description=req.description,
        version="1.0.0",
        tags=json.dumps(req.tags),
        file_path=file_path,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    logger.info(f"Created workflow: {wf_id}")
    return {"ok": True, "workflow_id": wf_id, "definition": definition}


@router.put("/{workflow_id}")
def update_workflow(workflow_id: str, req: WorkflowUpdateRequest, session: Session = Depends(get_session)):
    """Update an existing workflow. Bumps the version."""
    record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == workflow_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    wf_data = load_workflow_file(record.file_path)

    # Apply updates
    if req.name is not None:
        wf_data["name"] = req.name
        record.name = req.name
    if req.description is not None:
        wf_data["description"] = req.description
        record.description = req.description
    if req.tags is not None:
        wf_data["tags"] = req.tags
        record.tags = json.dumps(req.tags)
    if req.steps is not None:
        wf_data["steps"] = req.steps
    if req.required_inputs is not None:
        wf_data["required_inputs"] = req.required_inputs
    if req.output is not None:
        wf_data["output"] = req.output
    if req.validation is not None:
        wf_data["validation"] = req.validation

    # Bump patch version
    parts = record.version.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    new_version = ".".join(parts)
    wf_data["version"] = new_version
    wf_data["modified_at"] = datetime.utcnow().isoformat() + "Z"
    record.version = new_version
    record.modified_at = datetime.utcnow()

    save_workflow_file(workflow_id, wf_data)
    session.add(record)
    session.commit()

    return {"ok": True, "version": new_version, "definition": wf_data}


@router.delete("/{workflow_id}")
def archive_workflow(workflow_id: str, session: Session = Depends(get_session)):
    """Archive (soft-delete) a workflow."""
    record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == workflow_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    record.is_archived = True
    record.is_active = False
    session.add(record)
    session.commit()
    return {"ok": True}


@router.post("/{workflow_id}/duplicate")
def duplicate_workflow(workflow_id: str, session: Session = Depends(get_session)):
    """Create a copy of an existing workflow."""
    record = session.exec(
        select(WorkflowRecord).where(WorkflowRecord.workflow_id == workflow_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    wf_data = load_workflow_file(record.file_path)
    new_id = f"{workflow_id}_copy_{uuid.uuid4().hex[:4]}"
    wf_data["id"] = new_id
    wf_data["name"] = f"{record.name} (Copy)"
    wf_data["version"] = "1.0.0"
    now = datetime.utcnow().isoformat() + "Z"
    wf_data["created_at"] = now
    wf_data["modified_at"] = now

    file_path = save_workflow_file(new_id, wf_data)
    new_record = WorkflowRecord(
        workflow_id=new_id,
        name=wf_data["name"],
        description=record.description,
        version="1.0.0",
        tags=record.tags,
        file_path=file_path,
    )
    session.add(new_record)
    session.commit()

    return {"ok": True, "new_workflow_id": new_id}
