"""Atlas Backend – History API Router"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from storage.database import get_session, ExecutionRecord, StepRecord
import json

router = APIRouter()


@router.get("/")
def list_executions(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """Return execution history, most recent first."""
    records = session.exec(
        select(ExecutionRecord)
        .order_by(ExecutionRecord.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return [{
        "execution_id": r.execution_id,
        "workflow_id": r.workflow_id,
        "workflow_name": r.workflow_name,
        "status": r.status,
        "steps_total": r.steps_total,
        "steps_completed": r.steps_completed,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "duration_seconds": r.duration_seconds,
        "error_message": r.error_message,
        "report_path": r.report_path,
        "created_at": r.created_at.isoformat(),
    } for r in records]


@router.get("/{execution_id}/steps")
def get_execution_steps(execution_id: str, session: Session = Depends(get_session)):
    """Get all steps for an execution (for detailed progress view)."""
    steps = session.exec(
        select(StepRecord)
        .where(StepRecord.execution_id == execution_id)
        .order_by(StepRecord.step_index)
    ).all()
    return steps


@router.delete("/{execution_id}")
def delete_execution(execution_id: str, session: Session = Depends(get_session)):
    """Delete an execution record and its steps."""
    steps = session.exec(select(StepRecord).where(StepRecord.execution_id == execution_id)).all()
    for s in steps:
        session.delete(s)
    record = session.exec(select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)).first()
    if record:
        session.delete(record)
    session.commit()
    return {"ok": True}


@router.get("/stats/summary")
def get_stats(session: Session = Depends(get_session)):
    """Aggregated stats for the dashboard."""
    all_records = session.exec(select(ExecutionRecord)).all()
    total = len(all_records)
    completed = sum(1 for r in all_records if r.status == "completed")
    failed = sum(1 for r in all_records if r.status == "failed")
    avg_duration = (
        sum(r.duration_seconds for r in all_records if r.duration_seconds) / max(1, completed)
    )
    return {
        "total_executions": total,
        "completed": completed,
        "failed": failed,
        "success_rate": round(completed / max(1, total) * 100, 1),
        "avg_duration_seconds": round(avg_duration, 1),
    }
