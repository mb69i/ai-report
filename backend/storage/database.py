"""
Atlas V2 Backend – PostgreSQL Database Models & Engine

Uses SQLModel (SQLAlchemy + Pydantic hybrid) with async PostgreSQL via asyncpg.
All V2 tables are defined here. Alembic handles migrations.
Falls back to SQLite for local development without Docker.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum

from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import JSON, Text, BigInteger, Index, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from pathlib import Path
from loguru import logger


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.utcnow()


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    admin = "admin"
    supervisor = "supervisor"
    operator = "operator"
    readonly = "read-only"


class ExecutionStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class InvestigationStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    dismissed = "dismissed"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ══════════════════════════════════════════════════════════════════════════════
#  V2 MODELS
# ══════════════════════════════════════════════════════════════════════════════


class User(SQLModel, table=True):
    """Authorized user of the Atlas platform."""
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str = ""
    role: str = Field(default=UserRole.operator)
    is_active: bool = True
    avatar_url: str = ""
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class WorkflowRecord(SQLModel, table=True):
    """
    Workflow definition – can be manually created or recorded via Teach Mode.
    The steps_json column stores the full Playwright action sequence.
    """
    __tablename__ = "workflows"

    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    description: str = ""
    version: str = "1.0.0"
    tags: str = "[]"                               # JSON array as string
    steps_json: str = "[]"                         # Recorded Playwright steps
    file_path: str = ""                            # Legacy: path to workflow JSON
    is_active: bool = True
    is_archived: bool = False
    skill_id: Optional[str] = None                 # Link to a Skill package
    created_by: str = "user"
    run_count: int = 0
    last_run_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)


class ExecutionRecord(SQLModel, table=True):
    """One row per workflow execution run."""
    __tablename__ = "executions"

    id: Optional[int] = Field(default=None, primary_key=True)
    execution_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    workflow_id: str = Field(index=True)
    workflow_name: str
    status: str = Field(default=ExecutionStatus.pending)
    triggered_by: str = "user"                     # user | cron | webhook | ai
    inputs_json: str = "{}"
    outputs_json: str = "{}"
    error_message: Optional[str] = None
    error_screenshot_url: Optional[str] = None     # S3 URL if failed
    steps_total: int = 0
    steps_completed: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    duration_seconds: Optional[float] = None
    report_path: Optional[str] = None


class StepRecord(SQLModel, table=True):
    """Granular record of each step within a workflow execution."""
    __tablename__ = "steps"

    id: Optional[int] = Field(default=None, primary_key=True)
    execution_id: str = Field(index=True)
    step_id: str = Field(default_factory=generate_uuid)
    step_index: int
    step_type: str                                 # navigate | click | fill | extract | etc.
    description: str = ""
    status: str = Field(default=ExecutionStatus.pending)
    result_json: str = "{}"
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class NormalizedReport(SQLModel, table=True):
    """
    Standardized warehouse data – the single source of truth.
    Every raw report (CSV, Excel, API) is transformed into this schema.
    """
    __tablename__ = "normalized_reports"

    id: Optional[int] = Field(default=None, sa_column_kwargs={"autoincrement": True}, primary_key=True)
    source_id: str = Field(default_factory=generate_uuid, index=True)
    source_type: str = ""                          # csv | excel | api | manual
    source_name: str = ""                          # e.g. "SAP Cycle Count Export"
    sku: str = Field(default="", index=True)
    location: str = Field(default="", index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    container_id: Optional[str] = Field(default=None, index=True)
    operator_id: Optional[str] = None
    quantity: int = 0
    expected_quantity: Optional[int] = None
    variance: Optional[int] = None
    status: str = ""                               # allocated | scanned | mismatch | ok
    raw_data_json: str = "{}"                      # Original row preserved
    captured_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)


class TimelineEvent(SQLModel, table=True):
    """
    Correlation Engine output – chronological warehouse activity trace.
    Links SKUs, locations, operators, and orders across time.
    """
    __tablename__ = "timeline_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    event_type: str = ""                           # picked | packed | counted | moved | shortage | received
    sku: str = Field(default="", index=True)
    location: str = Field(default="", index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    container_id: Optional[str] = None
    operator_id: Optional[str] = None
    quantity: Optional[int] = None
    metadata_json: str = "{}"
    timestamp: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)


class Investigation(SQLModel, table=True):
    """
    Investigation Engine output – automated root-cause analysis.
    """
    __tablename__ = "investigations"

    id: Optional[int] = Field(default=None, primary_key=True)
    investigation_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    title: str
    status: str = Field(default=InvestigationStatus.open)
    sku: Optional[str] = Field(default=None, index=True)
    location: Optional[str] = Field(default=None, index=True)
    order_id: Optional[str] = None
    root_cause: str = ""
    confidence_score: float = 0.0                  # 0.0 – 1.0
    risk_score: float = 0.0
    priority: str = Field(default=Priority.medium)
    evidence_json: str = "[]"                      # Array of evidence items
    similar_cases_json: str = "[]"
    recommended_action: str = ""
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ReportRecord(SQLModel, table=True):
    """Tracks generated report files (Excel, PDF, CSV)."""
    __tablename__ = "reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    execution_id: Optional[str] = Field(default=None, index=True)
    workflow_id: Optional[str] = None
    name: str
    format: str                                    # excel | pdf | csv | json
    file_path: str
    file_url: Optional[str] = None                 # S3 URL
    file_size_bytes: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    is_deleted: bool = False


class LogEntry(SQLModel, table=True):
    """
    Application log storage for the UI log viewer.
    Logs are human-friendly, never raw stack traces.
    """
    __tablename__ = "logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    level: str                                     # INFO | WARNING | ERROR | SUCCESS
    source: str                                    # collector | normalizer | correlator | investigator | ai | system
    message: str                                   # Human-friendly message
    details_json: str = "{}"
    execution_id: Optional[str] = None
    workflow_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class ChatMessage(SQLModel, table=True):
    """Persists AI chat conversation history."""
    __tablename__ = "chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[str] = None
    role: str                                      # user | assistant | system
    content: str
    metadata_json: str = "{}"
    created_at: datetime = Field(default_factory=utcnow)


class SkillRecord(SQLModel, table=True):
    """
    Installable Skill packages – each extends Atlas with collectors,
    parsers, dashboards, AI prompts, and notifications.
    """
    __tablename__ = "skills"

    id: Optional[int] = Field(default=None, primary_key=True)
    skill_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    version: str
    description: str = ""
    author: str = ""
    category: str = ""                             # cycle_count | picking | packing | inventory | receiving | shipping
    is_enabled: bool = True
    is_builtin: bool = False
    manifest_json: str = "{}"                      # Full skill manifest
    installed_at: datetime = Field(default_factory=utcnow)


class SettingRecord(SQLModel, table=True):
    """Key-value store for persistent user settings."""
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    value: str
    value_type: str = "string"                     # string | int | bool | json
    updated_at: datetime = Field(default_factory=utcnow)


class PluginRecord(SQLModel, table=True):
    """Tracks installed marketplace plugins."""
    __tablename__ = "plugins"

    id: Optional[int] = Field(default=None, primary_key=True)
    plugin_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    version: str
    description: str = ""
    author: str = ""
    plugin_type: str                               # workflow | extractor | reporter | ai_model | connector
    is_enabled: bool = True
    manifest_path: str
    installed_at: datetime = Field(default_factory=utcnow)


# ══════════════════════════════════════════════════════════════════════════════
#  ASYNC ENGINE & SESSION
# ══════════════════════════════════════════════════════════════════════════════

_async_engine = None
_async_session_factory = None


def _get_database_url() -> str:
    """Resolve database URL from settings, with SQLite fallback."""
    try:
        from config.settings import get_settings
        return get_settings().database_url
    except Exception:
        # Fallback for local dev without PostgreSQL
        root = Path(__file__).parent.parent.parent
        db_path = root / "data" / "atlas.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{db_path}"


def get_async_engine():
    """Create or return the cached async engine."""
    global _async_engine
    if _async_engine is None:
        url = _get_database_url()
        is_sqlite = url.startswith("sqlite")
        _async_engine = create_async_engine(
            url,
            echo=False,
            **({} if is_sqlite else {"pool_size": 20, "max_overflow": 10}),
        )
    return _async_engine


def get_session_factory():
    """Create or return the cached session factory."""
    global _async_session_factory
    if _async_session_factory is None:
        engine = get_async_engine()
        _async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
    return _async_session_factory


async def get_session():
    """FastAPI dependency — yields an async database session."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db() -> None:
    """Create all tables. Called on application startup."""
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("Atlas V2 database initialized.")


async def close_db() -> None:
    """Clean up engine connections on shutdown."""
    global _async_engine, _async_session_factory
    if _async_engine:
        await _async_engine.dispose()
        _async_engine = None
        _async_session_factory = None
    logger.info("Database connections closed.")


# ── Legacy sync support (for Alembic and one-off scripts) ─────────────────────

def get_sync_engine():
    """Synchronous engine for Alembic migrations."""
    try:
        from config.settings import get_settings
        sync_url = get_settings().database_url_sync
    except Exception:
        root = Path(__file__).parent.parent.parent
        db_path = root / "data" / "atlas.db"
        sync_url = f"sqlite:///{db_path}"

    from sqlalchemy import create_engine as create_sync_engine
    return create_sync_engine(sync_url, echo=False)


# Keep backward compat alias
def init_db_sync() -> None:
    """Synchronous version for scripts that can't use async."""
    engine = get_sync_engine()
    SQLModel.metadata.create_all(engine)
    logger.info("Atlas V2 database initialized (sync).")
