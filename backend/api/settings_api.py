"""Atlas Backend – Settings API Router"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from loguru import logger
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from storage.database import get_session, SettingRecord
from config.settings import get_atlas_config, save_atlas_config, reload_settings

router = APIRouter()

ROOT_DIR = Path(__file__).parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _read_env() -> dict:
    """Parse .env file into a dict."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def _write_env(env: dict) -> None:
    """Write the env dict back to .env file, preserving comments."""
    # Read existing lines to preserve comments
    lines: list[str] = []
    written_keys: set[str] = set()

    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or not stripped:
                lines.append(line)
                continue
            if "=" in stripped:
                k = stripped.split("=", 1)[0].strip()
                if k in env:
                    lines.append(f"{k}={env[k]}")
                    written_keys.add(k)
                else:
                    lines.append(line)
            else:
                lines.append(line)
    
    # Append any new keys that weren't in the file
    for k, v in env.items():
        if k not in written_keys:
            lines.append(f"{k}={v}")

    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ── Pydantic models ────────────────────────────────────────────────────────────

class SettingUpdateRequest(BaseModel):
    key: str
    value: str
    value_type: str = "string"


class ApiKeysRequest(BaseModel):
    # Optional – send None or empty string to leave existing key unchanged
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None


class ConnectionTestRequest(BaseModel):
    provider: str          # "gemini" | "openai" | "ollama"
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/")
def get_all_settings(session: Session = Depends(get_session)):
    """Return all settings (DB + config file merged). API keys are masked."""
    config = get_atlas_config()
    db_settings = session.exec(select(SettingRecord)).all()
    db_dict = {s.key: s.value for s in db_settings}

    # Include masked key status from .env
    env = _read_env()
    gemini_key = env.get("GEMINI_API_KEY", "").strip()
    keys_status = {
        "gemini_configured": bool(gemini_key),
        "openai_configured": bool(env.get("OPENAI_API_KEY", "").strip()),
    }

    # Proactively check available models if Gemini key is set
    available_gemini_models = []
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            available_gemini_models = [
                m.name.replace("models/", "")
                for m in genai.list_models()
                if "generateContent" in m.supported_generation_methods
            ]
        except Exception:
            pass

    return {
        "config": config,
        "overrides": db_dict,
        "keys_status": keys_status,
        "available_gemini_models": available_gemini_models,
    }


@router.put("/")
def update_setting(req: SettingUpdateRequest, session: Session = Depends(get_session)):
    """Update or create a DB setting override."""
    existing = session.exec(
        select(SettingRecord).where(SettingRecord.key == req.key)
    ).first()
    if existing:
        existing.value = req.value
        existing.value_type = req.value_type
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        session.add(SettingRecord(
            key=req.key,
            value=req.value,
            value_type=req.value_type,
        ))
    session.commit()
    return {"ok": True}


@router.put("/config")
def update_config(config_update: dict):
    """Update atlas.config.json directly (deep merge)."""
    current = get_atlas_config()
    for k, v in config_update.items():
        if isinstance(v, dict) and k in current:
            current[k].update(v)
        else:
            current[k] = v
    save_atlas_config(current)
    return {"ok": True}


@router.put("/keys")
def save_api_keys(req: ApiKeysRequest):
    """
    Securely save API keys to .env file.
    Keys are never returned to the client; only a configured/not-configured status is exposed.
    A field that is None or empty string is ignored — the existing key in .env is kept.
    """
    env = _read_env()
    updated = []

    if req.gemini_api_key is not None and req.gemini_api_key.strip():
        env["GEMINI_API_KEY"] = req.gemini_api_key.strip()
        updated.append("Gemini")

    if req.openai_api_key is not None and req.openai_api_key.strip():
        env["OPENAI_API_KEY"] = req.openai_api_key.strip()
        updated.append("OpenAI")

    if not updated:
        return {"ok": True, "message": "No changes — leave a field empty to keep the existing key."}

    _write_env(env)

    # Reload settings in-process so the orchestrator picks them up immediately
    try:
        reload_settings()
        logger.info(f"API keys updated and hot-reloaded for: {', '.join(updated)}")
    except Exception as e:
        logger.error(f"Failed to hot-reload settings: {e}")

    return {"ok": True, "message": f"API keys saved: {', '.join(updated)}"}


@router.post("/test-connection")
async def test_connection(req: ConnectionTestRequest):
    """
    Test connectivity for a given AI provider.
    Uses provided api_key/model if given, otherwise falls back to configured .env values.
    """
    env = _read_env()

    try:
        # ── Gemini ─────────────────────────────────────────────────────────────
        if req.provider == "gemini":
            api_key = req.api_key or env.get("GEMINI_API_KEY", "")
            if not api_key:
                return {"ok": False, "message": "No Gemini API key configured."}

            import google.generativeai as genai
            genai.configure(api_key=api_key)

            # 1. Discover which models this key actually has access to
            try:
                available = [
                    m.name.replace("models/", "")
                    for m in genai.list_models()
                    if "generateContent" in m.supported_generation_methods
                ]
            except Exception as list_err:
                return {"ok": False, "message": f"Could not list models: {str(list_err)[:200]}"}

            if not available:
                return {"ok": False, "message": "API key valid but no generative models available on this account."}

            # 2. Pick the test model: prefer user-specified, else try flash variants, else first available
            preferred_order = [
                req.model,
                "gemini-3.5-flash",
                "gemini-3.1-flash-lite",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
                "gemini-2.5-flash",
                "gemini-1.5-flash",
                "gemini-2.5-pro",
                "gemini-1.5-pro",
            ]
            test_model = next(
                (m for m in preferred_order if m and m in available),
                available[0],  # fallback to whatever is first
            )

            # 3. Send a tiny test message
            from ai.gemini_client import GeminiClient
            client = GeminiClient(api_key, test_model)
            resp = await client.chat("Respond with only the word: OK", system="")
            top_models = ", ".join(available[:4])
            return {
                "ok": True,
                "message": f"Connected using {test_model}",
                "detail": f"Available models: {top_models}{' …' if len(available) > 4 else ''}",
                "available_models": available,
            }

        # ── OpenAI ─────────────────────────────────────────────────────────────
        elif req.provider == "openai":
            api_key = req.api_key or env.get("OPENAI_API_KEY", "")
            model = req.model or "gpt-4o-mini"
            if not api_key:
                return {"ok": False, "message": "No OpenAI API key configured."}
            from ai.openai_client import OpenAIClient
            client = OpenAIClient(api_key, model)
            ok = await client.is_available()
            if ok:
                return {"ok": True, "message": f"Connected ({model})"}
            return {"ok": False, "message": "OpenAI reachable but model may be unavailable."}

        # ── Ollama ─────────────────────────────────────────────────────────────
        elif req.provider == "ollama":
            base_url = req.base_url or env.get("OLLAMA_BASE_URL", "http://localhost:11434")
            model = req.model or "llama3.2"
            from ai.ollama_client import OllamaClient
            client = OllamaClient(base_url, model)
            ok = await client.is_available()
            if ok:
                return {"ok": True, "message": f"Ollama running at {base_url}"}
            return {"ok": False, "message": f"Ollama not reachable at {base_url}. Is it running?"}

        else:
            return {"ok": False, "message": f"Unknown provider: {req.provider}"}

    except Exception as e:
        err = str(e)
        # Give cleaner messages for common errors
        if "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err:
            return {"ok": False, "message": "API key valid but quota exhausted. Upgrade plan or wait for reset.", "quota": True}
        if "403" in err or "permission" in err.lower() or "API_KEY_INVALID" in err:
            return {"ok": False, "message": "Invalid API key — check it was copied correctly."}
        return {"ok": False, "message": f"Connection error: {err[:200]}"}
