"""Atlas Backend – Plugin Manager API Router"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from storage.database import get_session, PluginRecord

router = APIRouter()


@router.get("/")
def list_plugins(session: Session = Depends(get_session)):
    """List all installed plugins."""
    return session.exec(select(PluginRecord)).all()


@router.put("/{plugin_id}/toggle")
def toggle_plugin(plugin_id: str, session: Session = Depends(get_session)):
    """Enable or disable a plugin."""
    plugin = session.exec(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id)).first()
    if plugin:
        plugin.is_enabled = not plugin.is_enabled
        session.add(plugin)
        session.commit()
        return {"ok": True, "enabled": plugin.is_enabled}
    return {"ok": False, "error": "Plugin not found"}
