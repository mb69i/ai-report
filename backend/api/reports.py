"""Atlas Backend – Reports API Router"""

import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from loguru import logger

from storage.database import get_session, ReportRecord, ExecutionRecord

router = APIRouter()
ROOT_DIR = Path(__file__).parent.parent.parent
REPORTS_DIR = ROOT_DIR / "reports"


class GenerateReportRequest(BaseModel):
    execution_id: str
    format: str = "excel"       # excel | pdf | word | csv | json
    template: str = "default"
    title: str = ""


@router.post("/generate")
async def generate_report(req: GenerateReportRequest, session: Session = Depends(get_session)):
    """Generate a report from an execution's extracted data."""
    exec_record = session.exec(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == req.execution_id)
    ).first()
    if not exec_record:
        raise HTTPException(status_code=404, detail="Execution not found.")

    import json
    outputs = json.loads(exec_record.outputs_json or "{}")
    inputs = json.loads(exec_record.inputs_json or "{}")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_id = str(uuid.uuid4())[:8]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    workflow_slug = exec_record.workflow_id.replace(" ", "_")
    filename = f"{workflow_slug}_{timestamp}_{report_id}"

    file_path = None

    try:
        if req.format == "excel":
            from reporting.excel_reporter import ExcelReporter
            reporter = ExcelReporter()
            file_path = reporter.generate(
                data=outputs,
                filename=filename,
                title=req.title or exec_record.workflow_name,
                output_dir=str(REPORTS_DIR),
                metadata={"workflow": exec_record.workflow_name, "run_date": timestamp, **inputs}
            )
        elif req.format == "pdf":
            from reporting.pdf_reporter import PdfReporter
            reporter = PdfReporter()
            file_path = reporter.generate(
                data=outputs,
                filename=filename,
                title=req.title or exec_record.workflow_name,
                output_dir=str(REPORTS_DIR),
            )
        elif req.format == "json":
            import json as jsonlib
            file_path = str(REPORTS_DIR / f"{filename}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                jsonlib.dump({"workflow": exec_record.workflow_name, "data": outputs}, f, indent=2)
        elif req.format == "csv":
            import csv
            file_path = str(REPORTS_DIR / f"{filename}.csv")
            # Export first list found in outputs as CSV
            rows = next((v for v in outputs.values() if isinstance(v, list)), [])
            if rows:
                with open(file_path, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows(rows)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {req.format}")

    except Exception as e:
        logger.error(f"Report generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Save report record
    file_size = Path(file_path).stat().st_size if file_path and Path(file_path).exists() else 0
    report_record = ReportRecord(
        report_id=report_id,
        execution_id=req.execution_id,
        workflow_id=exec_record.workflow_id,
        name=req.title or exec_record.workflow_name,
        format=req.format,
        file_path=file_path,
        file_size_bytes=file_size,
    )
    session.add(report_record)

    # Link report to execution
    exec_record.report_path = file_path
    session.add(exec_record)
    session.commit()

    return {
        "ok": True,
        "report_id": report_id,
        "file_path": file_path,
        "format": req.format,
        "file_size_bytes": file_size,
    }


@router.get("/")
def list_reports(session: Session = Depends(get_session)):
    """List all generated reports."""
    records = session.exec(
        select(ReportRecord)
        .where(ReportRecord.is_deleted == False)
        .order_by(ReportRecord.created_at.desc())
    ).all()
    return records


@router.get("/download/{report_id}")
def download_report(report_id: str, session: Session = Depends(get_session)):
    """Download a report file."""
    record = session.exec(
        select(ReportRecord).where(ReportRecord.report_id == report_id)
    ).first()
    if not record or not Path(record.file_path).exists():
        raise HTTPException(status_code=404, detail="Report file not found.")
    return FileResponse(record.file_path, filename=Path(record.file_path).name)


@router.delete("/{report_id}")
def delete_report(report_id: str, session: Session = Depends(get_session)):
    """Soft-delete a report record."""
    record = session.exec(select(ReportRecord).where(ReportRecord.report_id == report_id)).first()
    if record:
        record.is_deleted = True
        session.add(record)
        session.commit()
    return {"ok": True}
