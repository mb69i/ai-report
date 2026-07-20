"""
Atlas Dev Launch Helper

Runs dev environments concurrently.
Usage: python scripts/dev.py
"""

import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent


def main():
    print("[Atlas] Starting all dev servers concurrently (Electron + React + FastAPI)...")
    try:
        subprocess.check_call(["npm.cmd", "run", "dev"], cwd=str(ROOT_DIR), shell=True)
    except KeyboardInterrupt:
        print("\n[Atlas] Dev environment closed.")


if __name__ == "__main__":
    main()
