"""
Atlas V2 Backend – FastAPI Main Application

Entry point for the Atlas backend server.
Registers all routers, initializes the async database, and manages lifecycle events.
"""

import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import uvicorn

# ── Path setup (allow imports from backend/) ──────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import get_settings, get_atlas_config
from storage.database import init_db, close_db

# ── Router imports ─────────────────────────────────────────────────────────────
from api import workflows, runner, ai_chat, reports, history, backup, plugins_api, settings_api, recorder_api, dashboard, search_api
from api import auth_api

settings = get_settings()
atlas_config = get_atlas_config()


# ── Lifecycle ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("=" * 60)
    logger.info(f"  Atlas Backend v{settings.app_version} starting...")
    logger.info(f"  Host: {settings.host}:{settings.port}")
    logger.info(f"  Debug: {settings.debug}")
    logger.info(f"  Database: {'PostgreSQL' if 'postgresql' in settings.database_url else 'SQLite (fallback)'}")
    logger.info("=" * 60)

    # Initialize async database (creates tables if needed)
    await init_db()

    # Ensure required directories exist
    root = Path(__file__).parent.parent
    for folder in ["data", "data/sessions", "data/downloads", "data/exports", "reports", "backups", "logs", "plugins"]:
        (root / folder).mkdir(parents=True, exist_ok=True)

    logger.info("Atlas backend ready.")

    yield

    # Shutdown: close DB connections
    await close_db()
    logger.info("Atlas backend shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Atlas API",
    description="AI-powered Warehouse Intelligence Operating System – Backend API",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS – allow the Next.js frontend (localhost:3000 in dev, production domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:7411",
        "null",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────

# V2: Auth
app.include_router(auth_api.router,     prefix="/api/auth",       tags=["Auth"])

# Core
app.include_router(workflows.router,    prefix="/api/workflows",  tags=["Workflows"])
app.include_router(runner.router,       prefix="/api/runner",     tags=["Runner"])
app.include_router(ai_chat.router,      prefix="/api/ai",         tags=["AI"])
app.include_router(reports.router,      prefix="/api/reports",    tags=["Reports"])
app.include_router(history.router,      prefix="/api/history",    tags=["History"])
app.include_router(backup.router,       prefix="/api/backup",     tags=["Backup"])
app.include_router(plugins_api.router,  prefix="/api/plugins",    tags=["Plugins"])
app.include_router(settings_api.router, prefix="/api/settings",   tags=["Settings"])
app.include_router(recorder_api.router, prefix="/api/recorder",   tags=["Recorder"])
app.include_router(dashboard.router,    prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(search_api.router,   prefix="/api/search",     tags=["Search"])


# ── Core Endpoints ────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint – frontend polls this before loading the UI."""
    return {"status": "ok", "version": settings.app_version}


@app.get("/api/system/info", tags=["System"])
async def system_info():
    """System information for the Settings page."""
    import platform
    return {
        "app_version": settings.app_version,
        "python_version": sys.version,
        "platform": platform.system(),
        "platform_version": platform.version(),
        "offline_mode": settings.offline_mode,
        "gemini_configured": bool(settings.gemini_api_key),
        "claude_configured": bool(settings.claude_api_key),
        "ollama_url": settings.ollama_base_url,
        "database": "postgresql" if "postgresql" in settings.database_url else "sqlite",
    }


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("ATLAS_PORT", settings.port))
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
