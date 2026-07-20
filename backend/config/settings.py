"""
Atlas V2 Backend – Configuration

Loads settings from environment variables / .env file.
Supports PostgreSQL, Redis, JWT auth, and S3 storage.
All configuration lives here — no hardcoded values anywhere else.
"""

import json
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from loguru import logger

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent.parent.parent
CONFIG_FILE = ROOT_DIR / "atlas.config.json"
ENV_FILE = ROOT_DIR / ".env"


def load_atlas_config() -> dict:
    """Load atlas.config.json from project root."""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


class Settings(BaseSettings):
    """
    Atlas V2 settings — values loaded from environment variables and .env file.
    """

    # ── App ────────────────────────────────────────────────────────────────
    app_name: str = "Atlas"
    app_version: str = "2.0.0"
    debug: bool = Field(default=False, alias="ATLAS_DEBUG")
    log_level: str = "INFO"
    secret_key: str = Field(default="change-me", alias="ATLAS_SECRET_KEY")

    # ── Backend Server ─────────────────────────────────────────────────────
    host: str = Field(default="127.0.0.1", alias="ATLAS_HOST")
    port: int = Field(default=7411, alias="ATLAS_PORT")

    # ── PostgreSQL ─────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://atlas:atlas_secret@localhost:5432/atlas_db",
        alias="DATABASE_URL",
    )
    # Sync URL for Alembic migrations
    @property
    def database_url_sync(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    # ── Redis ──────────────────────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # ── JWT Auth ───────────────────────────────────────────────────────────
    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=480, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # ── AI Services ────────────────────────────────────────────────────────
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    claude_api_key: str = Field(default="", alias="CLAUDE_API_KEY")
    ollama_base_url: str = Field(
        default="http://localhost:11434", alias="OLLAMA_BASE_URL"
    )
    offline_mode: bool = Field(default=False, alias="ATLAS_OFFLINE_MODE")
    ai_data_privacy: bool = Field(default=True, alias="ATLAS_AI_DATA_PRIVACY")

    # ── S3 Storage ─────────────────────────────────────────────────────────
    s3_endpoint: str = Field(default="", alias="S3_ENDPOINT")
    s3_access_key: str = Field(default="", alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field(default="", alias="S3_SECRET_KEY")
    s3_bucket: str = Field(default="atlas-reports", alias="S3_BUCKET")
    s3_region: str = Field(default="us-east-1", alias="S3_REGION")

    # ── Security ───────────────────────────────────────────────────────────
    encryption_key: str = Field(default="", alias="ATLAS_ENCRYPTION_KEY")

    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }


# ── Singleton instances ───────────────────────────────────────────────────────
settings = Settings()
atlas_config = load_atlas_config()


def get_settings() -> Settings:
    return settings


def get_atlas_config() -> dict:
    return atlas_config


def reload_settings() -> None:
    """Hot-reload settings from .env and config file into memory."""
    global settings, atlas_config
    if ENV_FILE.exists():
        try:
            import dotenv
            dotenv.load_dotenv(ENV_FILE, override=True)
        except Exception as e:
            logger.warning(f"Failed to reload .env file: {e}")
    settings = Settings()
    atlas_config = load_atlas_config()
    logger.info("Atlas configuration hot-reloaded.")


def save_atlas_config(new_config: dict) -> None:
    """Persist updated atlas.config.json to disk."""
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(new_config, f, indent=2)
    logger.info("Atlas config saved.")
    reload_settings()
