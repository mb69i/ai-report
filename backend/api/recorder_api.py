"""
Atlas Backend – Workflow Recorder API

REST endpoints for the "Live Record & Generate" feature in Training Mode.
The browser records all user interactions; the AI converts them to workflow JSON.

Routes:
  POST /api/recorder/start                 – Open browser, begin capturing
  GET  /api/recorder/events/{session_id}   – SSE stream of live events
  POST /api/recorder/stop/{session_id}     – Stop browser, get all events
  POST /api/recorder/generate              – AI generates workflow from events
"""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from loguru import logger

router = APIRouter()


# ── Request Models ─────────────────────────────────────────────────────────────

class StartRecordingRequest(BaseModel):
    start_url: str
    description: str = ""


class GenerateWorkflowRequest(BaseModel):
    session_id: Optional[str] = None
    description: str
    events: list[dict]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_recording(req: StartRecordingRequest):
    """
    Launch a Chromium browser window and begin recording the user's interactions.
    Returns a session_id used to stream events and stop the recording.
    """
    if not req.start_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="start_url must begin with http:// or https://")

    try:
        from automation.recorder import create_session
        session = await create_session(req.start_url, req.description)
        return {
            "ok": True,
            "session_id": session.session_id,
            "status": session.status,
            "message": (
                "Browser opened. Perform your workflow in the browser, "
                "then click 'Stop & Generate' when done."
            ),
        }
    except Exception as exc:
        logger.error(f"Recorder start failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Could not launch browser: {exc}")


@router.get("/events/{session_id}")
async def stream_events(session_id: str):
    """
    Server-Sent Events stream of captured interactions.
    The frontend subscribes to this to show a live event feed.
    """
    from automation.recorder import get_session

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    async def generate():
        # Replay already-captured events first (for reconnection)
        for evt in list(session.events):
            yield f"data: {json.dumps(evt)}\n\n"

        # Stream new events until recording stops
        while session.status == "recording":
            try:
                evt = await asyncio.wait_for(session.queue.get(), timeout=2.0)
                yield f"data: {json.dumps(evt)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"   # keep-alive heartbeat
            except Exception:
                break

        # Signal end-of-stream
        yield "data: {\"type\": \"__done__\"}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/stop/{session_id}")
async def stop_recording(session_id: str):
    """
    Stop the browser recording session and return all captured events.
    The browser window is closed automatically.
    """
    try:
        from automation.recorder import stop_session
        events = await stop_session(session_id)
        return {
            "ok": True,
            "session_id": session_id,
            "event_count": len(events),
            "events": events,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"Recorder stop failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate")
async def generate_workflow(req: GenerateWorkflowRequest):
    """
    Send the captured event log to the AI and receive a ready-to-use workflow JSON.
    The AI identifies runtime inputs, groups events into named steps, and
    outputs the exact schema Atlas uses.
    """
    if not req.events:
        raise HTTPException(status_code=400, detail="No events provided. Record a workflow first.")

    try:
        from ai.orchestrator import get_orchestrator
        orchestrator = get_orchestrator()
        workflow = await orchestrator.generate_workflow_from_recording(
            events=req.events,
            description=req.description,
        )
        return {"ok": True, "workflow": workflow}
    except Exception as exc:
        logger.error(f"Workflow generation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {exc}")
