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
#  WAREHOUSE DOMAIN MODELS (V2 EVENT-DRIVEN CORE)
# ══════════════════════════════════════════════════════════════════════════

class SKU(SQLModel, table=True):
    """Warehouse Stock Keeping Unit (SKU) record."""
    __tablename__ = "skus"

    id: Optional[int] = Field(default=None, primary_key=True)
    sku_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    sku_code: str = Field(unique=True, index=True)  # e.g., "WH-4491"
    name: str
    description: str = ""
    category: str = ""                              # e.g., "Electronics", "Apparel"
    unit_cost: float = 0.0
    created_at: datetime = Field(default_factory=utcnow)


class Location(SQLModel, table=True):
    """Physical location inside the warehouse."""
    __tablename__ = "locations"

    id: Optional[int] = Field(default=None, primary_key=True)
    location_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    zone: str                                       # e.g., "A"
    aisle: str                                      # e.g., "12"
    shelf: str                                      # e.g., "2"
    position: str                                   # e.g., "A1"
    status: str = "active"                          # active | locked
    created_at: datetime = Field(default_factory=utcnow)

    @property
    def name(self) -> str:
        """Returns the standardized location name, e.g. 'A-12-2-A1'"""
        return f"{self.zone}-{self.aisle}-{self.shelf}-{self.position}"


class Operator(SQLModel, table=True):
    """Warehouse worker or operator."""
    __tablename__ = "operators"

    id: Optional[int] = Field(default=None, primary_key=True)
    operator_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    badge_number: str = Field(unique=True, index=True)  # e.g., "OP-882"
    full_name: str
    role: str = "picker"                            # picker | packer | counter | receiver
    status: str = "active"                          # active | inactive
    created_at: datetime = Field(default_factory=utcnow)


class OrderRecord(SQLModel, table=True):
    """Warehouse fulfillment order."""
    __tablename__ = "orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    order_number: str = Field(unique=True, index=True)  # e.g., "ORD-78291"
    customer_name: str = ""
    status: str = "pending"                         # pending | picking | packed | shipped | cancelled
    created_at: datetime = Field(default_factory=utcnow)


class Container(SQLModel, table=True):
    """Tote, pallet, or box holding inventory items."""
    __tablename__ = "containers"

    id: Optional[int] = Field(default=None, primary_key=True)
    container_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    container_code: str = Field(unique=True, index=True)  # e.g., "CT-8812"
    type: str = "tote"                              # tote | pallet | box
    current_location_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class WarehouseEvent(SQLModel, table=True):
    """Single audit log entry representing physical inventory activity."""
    __tablename__ = "warehouse_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    event_type: str = Field(index=True)            # cycle_count | pick | pack | receive | ship | move
    sku_id: str = Field(index=True)                 # SKU UUID or Code
    location_id: str = Field(index=True)            # Location UUID or Name
    operator_id: Optional[str] = Field(default=None, index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    container_id: Optional[str] = Field(default=None, index=True)
    quantity_recorded: int = 0
    quantity_expected: int = 0
    variance: int = 0                               # quantity_recorded - quantity_expected
    raw_metadata: str = "{}"                        # Audit details JSON payload
    timestamp: datetime = Field(default_factory=utcnow, index=True)


class Investigation(SQLModel, table=True):
    """Root-cause investigation details generated by the engine."""
    __tablename__ = "investigations"

    id: Optional[int] = Field(default=None, primary_key=True)
    investigation_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    title: str
    status: str = Field(default=InvestigationStatus.open)
    sku_id: Optional[str] = Field(default=None, index=True)
    location_id: Optional[str] = Field(default=None, index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    root_cause_category: str = ""                   # e.g. "scan_bypass", "double_allocation"
    root_cause_explanation: str = ""
    confidence_score: float = 0.0                  # 0.0 – 1.0
    risk_score: float = 0.0
    priority: str = Field(default=Priority.medium)
    recommended_action: str = ""
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Evidence(SQLModel, table=True):
    """Structured proof backing up an investigation analysis."""
    __tablename__ = "evidence"

    id: Optional[int] = Field(default=None, primary_key=True)
    evidence_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    investigation_id: str = Field(index=True)       # FK to investigations
    event_id: str = Field(index=True)               # FK to warehouse_events
    type: str = "count_discrepancy"                 # count_discrepancy | operator_trace | transaction_gap
    description: str
    created_at: datetime = Field(default_factory=utcnow)


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM & SETTINGS MODELS
# ══════════════════════════════════════════════════════════════════════════

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
    """Workflow metadata and Playwright steps definition."""
    __tablename__ = "workflows"

    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    description: str = ""
    version: str = "1.0.0"
    tags: str = "[]"                               # JSON array as string
    steps_json: str = "[]"                         # Recorded Playwright steps
    file_path: str = ""                            # Path to workflow JSON file
    is_active: bool = True
    is_archived: bool = False
    skill_id: Optional[str] = None
    created_by: str = "user"
    run_count: int = 0
    last_run_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    modified_at: datetime = Field(default_factory=utcnow)


class ExecutionRecord(SQLModel, table=True):
    """Execution history logs of automated workflows."""
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
    error_screenshot_url: Optional[str] = None
    steps_total: int = 0
    steps_completed: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    duration_seconds: Optional[float] = None
    report_path: Optional[str] = None


class StepRecord(SQLModel, table=True):
    """Step execution status trace records."""
    __tablename__ = "steps"

    id: Optional[int] = Field(default=None, primary_key=True)
    execution_id: str = Field(index=True)
    step_id: str = Field(default_factory=generate_uuid)
    step_index: int
    step_type: str
    description: str = ""
    status: str = Field(default=ExecutionStatus.pending)
    result_json: str = "{}"
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class ReportRecord(SQLModel, table=True):
    """Metadata regarding generated PDF/Excel documents."""
    __tablename__ = "reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    execution_id: Optional[str] = Field(default=None, index=True)
    workflow_id: Optional[str] = None
    name: str
    format: str                                    # excel | pdf | csv | json
    file_path: str
    file_url: Optional[str] = None
    file_size_bytes: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    is_deleted: bool = False


class LogEntry(SQLModel, table=True):
    """Human-friendly logging audits."""
    __tablename__ = "logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    level: str                                     # INFO | WARNING | ERROR | SUCCESS
    source: str                                    # collector | normalizer | correlator | investigator | ai | system
    message: str
    details_json: str = "{}"
    execution_id: Optional[str] = None
    workflow_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class ChatMessage(SQLModel, table=True):
    """AI conversation logs."""
    __tablename__ = "chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[str] = None
    role: str
    content: str
    metadata_json: str = "{}"
    created_at: datetime = Field(default_factory=utcnow)


class SkillRecord(SQLModel, table=True):
    """Installed skill templates."""
    __tablename__ = "skills"

    id: Optional[int] = Field(default=None, primary_key=True)
    skill_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    version: str
    description: str = ""
    author: str = ""
    category: str = ""
    is_enabled: bool = True
    is_builtin: bool = False
    manifest_json: str = "{}"
    installed_at: datetime = Field(default_factory=utcnow)


class SettingRecord(SQLModel, table=True):
    """Settings overrides store."""
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    value: str
    value_type: str = "string"
    updated_at: datetime = Field(default_factory=utcnow)


class PluginRecord(SQLModel, table=True):
    """Installed plugins manager."""
    __tablename__ = "plugins"

    id: Optional[int] = Field(default=None, primary_key=True)
    plugin_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    name: str
    version: str
    description: str = ""
    author: str = ""
    plugin_type: str
    is_enabled: bool = True
    manifest_path: str
    installed_at: datetime = Field(default_factory=utcnow)


class NormalizedReport(SQLModel, table=True):
    """Legacy report parsing store - kept for backward compatibility."""
    __tablename__ = "normalized_reports"

    id: Optional[int] = Field(default=None, sa_column_kwargs={"autoincrement": True}, primary_key=True)
    source_id: str = Field(default_factory=generate_uuid, index=True)
    source_type: str = ""
    source_name: str = ""
    sku: str = Field(default="", index=True)
    location: str = Field(default="", index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    container_id: Optional[str] = Field(default=None, index=True)
    operator_id: Optional[str] = None
    quantity: int = 0
    expected_quantity: Optional[int] = None
    variance: Optional[int] = None
    status: str = ""
    raw_data_json: str = "{}"
    captured_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)


class TimelineEvent(SQLModel, table=True):
    """Legacy correlation timeline - kept for backward compatibility."""
    __tablename__ = "timeline_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(default_factory=generate_uuid, unique=True, index=True)
    event_type: str = ""
    sku: str = Field(default="", index=True)
    location: str = Field(default="", index=True)
    order_id: Optional[str] = Field(default=None, index=True)
    container_id: Optional[str] = None
    operator_id: Optional[str] = None
    quantity: Optional[int] = None
    metadata_json: str = "{}"
    timestamp: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)


# ══════════════════════════════════════════════════════════════════════════════
#  ASYNC ENGINE & SESSION
# ══════════════════════════════════════════════════════════════════════════

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
    """Create all tables. Called on application startup. Falls back to SQLite if PostgreSQL fails."""
    global _async_engine, _async_session_factory
    engine = get_async_engine()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Atlas V2 database initialized.")
    except Exception as e:
        url = _get_database_url()
        if "postgresql" in url:
            logger.warning(f"PostgreSQL connection failed ({e}). Falling back to SQLite for local development...")
            # Recreate engine with SQLite
            root = Path(__file__).parent.parent.parent
            db_path = root / "data" / "atlas.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            fallback_url = f"sqlite+aiosqlite:///{db_path}"
            
            # Reset engine and session factory
            if _async_engine:
                await _async_engine.dispose()
            _async_engine = create_async_engine(fallback_url, echo=False)
            _async_session_factory = async_sessionmaker(
                _async_engine, class_=AsyncSession, expire_on_commit=False
            )
            
            # Try initializing SQLite
            async with _async_engine.begin() as conn:
                await conn.run_sync(SQLModel.metadata.create_all)
            logger.info("Atlas V2 database initialized with SQLite fallback.")
        else:
            raise e


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
