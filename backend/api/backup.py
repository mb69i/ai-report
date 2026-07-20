"""Atlas Backend – Backup API Router"""

import shutil
import uuid
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from loguru import logger

router = APIRouter()
ROOT_DIR = Path(__file__).parent.parent.parent
BACKUPS_DIR = ROOT_DIR / "backups"


@router.post("/create")
async def create_backup(background_tasks: BackgroundTasks):
    """Create a timestamped backup of the data directory."""
    backup_id = uuid.uuid4().hex[:8]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"atlas_backup_{timestamp}_{backup_id}"

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUPS_DIR / backup_name

    def do_backup():
        try:
            # Backup data directory (DB, exports)
            if (ROOT_DIR / "data").exists():
                shutil.copytree(ROOT_DIR / "data", backup_path / "data")
            # Backup workflow definitions
            if (ROOT_DIR / "workflows").exists():
                shutil.copytree(ROOT_DIR / "workflows", backup_path / "workflows")
            # Backup reports
            if (ROOT_DIR / "reports").exists():
                shutil.copytree(ROOT_DIR / "reports", backup_path / "reports")
            # Save manifest
            manifest = {
                "backup_id": backup_id,
                "created_at": datetime.utcnow().isoformat(),
                "backup_name": backup_name,
            }
            with open(backup_path / "manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)
            logger.info(f"Backup created: {backup_path}")
        except Exception as e:
            logger.error(f"Backup failed: {e}")

    background_tasks.add_task(do_backup)
    return {"ok": True, "backup_name": backup_name, "status": "creating"}


@router.get("/list")
def list_backups():
    """List all available backups."""
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backups = []
    for d in sorted(BACKUPS_DIR.iterdir(), reverse=True):
        if d.is_dir():
            manifest_file = d / "manifest.json"
            if manifest_file.exists():
                manifest = json.loads(manifest_file.read_text())
                size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
                backups.append({**manifest, "size_bytes": size, "path": str(d)})
    return backups


@router.post("/create-blank-copy")
async def create_blank_copy(background_tasks: BackgroundTasks, destination: str = None):
    """
    Create a complete blank copy of the Atlas project (no user data).
    Copies: source code, configs, workflow templates, plugins, UI, docs, scripts.
    Excludes: database, reports, logs, cache, credentials, user-generated data.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest_name = f"Atlas_Blank_{timestamp}"
    dest_path = Path(destination) if destination else ROOT_DIR.parent / dest_name

    EXCLUDE_DIRS = {"data", "reports", "logs", "backups", "__pycache__", ".pytest_cache",
                    "node_modules", "dist", "dist-electron", ".git"}
    EXCLUDE_FILES = {".env", "atlas.db"}

    def do_copy():
        try:
            dest_path.mkdir(parents=True, exist_ok=True)

            def ignore_fn(src, names):
                ignored = set()
                for name in names:
                    if name in EXCLUDE_DIRS or name in EXCLUDE_FILES:
                        ignored.add(name)
                    if name.endswith(".db") or name.endswith(".log"):
                        ignored.add(name)
                return ignored

            # Copy top-level dirs that contain code/config
            for folder in ["app", "ui", "backend", "workflows", "plugins", "scripts", "docs", "assets"]:
                src = ROOT_DIR / folder
                if src.exists():
                    shutil.copytree(src, dest_path / folder, ignore=ignore_fn)

            # Copy root config files
            for file in ["package.json", "requirements.txt", ".env.example",
                         "atlas.config.json", "README.md"]:
                src_file = ROOT_DIR / file
                if src_file.exists():
                    shutil.copy2(src_file, dest_path / file)

            # Create empty placeholder directories
            for d in ["data", "reports", "logs", "backups", "plugins"]:
                (dest_path / d).mkdir(exist_ok=True)
                (dest_path / d / ".gitkeep").touch()

            logger.info(f"Blank copy created at: {dest_path}")
        except Exception as e:
            logger.error(f"Blank copy failed: {e}")

    background_tasks.add_task(do_copy)
    return {"ok": True, "destination": str(dest_path), "status": "creating"}
