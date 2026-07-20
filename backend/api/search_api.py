"""
Atlas V2 Backend – Universal Search API

Full-text search across SKUs, Locations, Investigations, Reports,
Workflows, and Operators in a single unified endpoint.
"""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import List, Dict, Any
from loguru import logger

from storage.database import (
    get_session,
    SKU,
    Location,
    Investigation,
    ReportRecord,
    WorkflowRecord,
    Operator,
)

router = APIRouter()


@router.get("/")
async def universal_search(
    q: str = Query(..., min_length=1, description="Search query"),
    category: str = Query("all", description="Filter category"),
    limit: int = Query(30, le=100),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """
    Searches across all warehouse entities. Returns grouped results by type.
    Category filter: all | sku | location | investigation | report | workflow | operator
    """
    q_lower = q.lower().strip()
    results: List[Dict[str, Any]] = []

    try:
        # ── SKUs ──────────────────────────────────────────────────────────────
        if category in ("all", "sku"):
            skus = (await session.execute(select(SKU))).scalars().all()
            for s in skus:
                if q_lower in (s.sku_code or "").lower() or q_lower in (s.description or "").lower():
                    results.append({
                        "type": "sku",
                        "id": str(s.sku_id),
                        "title": s.sku_code,
                        "subtitle": s.description or "No description",
                        "meta": f"Category: {s.category or '–'} · UOM: {s.unit_of_measure or '–'}",
                        "href": f"/search?q={s.sku_code}&category=sku",
                    })

        # ── Locations ─────────────────────────────────────────────────────────
        if category in ("all", "location"):
            locs = (await session.execute(select(Location))).scalars().all()
            for loc in locs:
                if q_lower in (loc.location_code or "").lower() or q_lower in (loc.zone or "").lower():
                    results.append({
                        "type": "location",
                        "id": str(loc.location_id),
                        "title": loc.location_code,
                        "subtitle": f"Zone {loc.zone}" if loc.zone else "No zone",
                        "meta": f"Aisle {loc.aisle or '–'} · Rack {loc.rack or '–'} · Capacity: {loc.capacity or '–'}",
                        "href": f"/search?q={loc.location_code}&category=location",
                    })

        # ── Investigations ────────────────────────────────────────────────────
        if category in ("all", "investigation"):
            invs = (await session.execute(select(Investigation))).scalars().all()
            for inv in invs:
                if q_lower in (inv.title or "").lower() or q_lower in (inv.root_cause_explanation or "").lower():
                    results.append({
                        "type": "investigation",
                        "id": str(inv.id),
                        "title": inv.title,
                        "subtitle": inv.root_cause_explanation or "Root cause pending",
                        "meta": f"Priority: {inv.priority} · Status: {inv.status} · Confidence: {round((inv.confidence_score or 0) * 100)}%",
                        "href": "/investigations",
                    })

        # ── Reports ───────────────────────────────────────────────────────────
        if category in ("all", "report"):
            reps = (await session.execute(
                select(ReportRecord).where(ReportRecord.is_deleted == False)
            )).scalars().all()
            for rep in reps:
                if q_lower in (rep.name or "").lower():
                    results.append({
                        "type": "report",
                        "id": rep.report_id,
                        "title": rep.name,
                        "subtitle": f"{rep.format.upper()} report",
                        "meta": f"Created: {rep.created_at.strftime('%b %d, %Y') if rep.created_at else '–'}",
                        "href": "/reports",
                    })

        # ── Workflows ─────────────────────────────────────────────────────────
        if category in ("all", "workflow"):
            wfs = (await session.execute(select(WorkflowRecord).where(WorkflowRecord.is_active == True))).scalars().all()
            for wf in wfs:
                if q_lower in (wf.name or "").lower() or q_lower in (wf.description or "").lower():
                    results.append({
                        "type": "workflow",
                        "id": wf.workflow_id,
                        "title": wf.name,
                        "subtitle": wf.description or "No description",
                        "meta": f"v{wf.version} · Run count: {wf.run_count}",
                        "href": "/automation",
                    })

        # ── Operators ─────────────────────────────────────────────────────────
        if category in ("all", "operator"):
            ops = (await session.execute(select(Operator))).scalars().all()
            for op in ops:
                if q_lower in (op.name or "").lower() or q_lower in (op.badge_id or "").lower():
                    results.append({
                        "type": "operator",
                        "id": str(op.operator_id),
                        "title": op.name,
                        "subtitle": f"Badge: {op.badge_id or '–'}",
                        "meta": f"Shift: {op.shift or '–'} · Zone: {op.zone or '–'}",
                        "href": f"/search?q={op.name}&category=operator",
                    })

        # Sort: exact matches first
        results.sort(key=lambda r: (0 if q_lower == r["title"].lower() else 1, r["type"]))

        return {
            "query": q,
            "total": len(results),
            "results": results[:limit],
        }

    except Exception as e:
        logger.error(f"Search failed for '{q}': {e}")
        return {"query": q, "total": 0, "results": []}
