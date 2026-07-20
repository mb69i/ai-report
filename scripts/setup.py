"""
Atlas Platform Setup & Installation Script

Configures virtual envs, python packages, node modules, and Playwright browser drivers.
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
UI_DIR = ROOT_DIR / "ui"


def run_cmd(args, cwd=None):
    cmd_str = " ".join(args)
    print(f"\n[Atlas Setup] Running: {cmd_str}")
    subprocess.check_call(args, cwd=cwd, shell=True)


def main():
    print("=" * 60)
    print("      ATLAS AUTOMATION PLATFORM – SYSTEM INSTALLATION")
    print("=" * 60)

    # 1. Install root package.json node modules
    print("\nInstalling Electron root dependencies...")
    run_cmd(["npm.cmd", "install"], cwd=str(ROOT_DIR))

    # 2. Install UI node modules
    print("\nInstalling React UI dependencies...")
    run_cmd(["npm.cmd", "install"], cwd=str(UI_DIR))

    # 3. Install Python requirements
    print("\nInstalling Python requirements...")
    run_cmd(["pip", "install", "-r", "requirements.txt"], cwd=str(ROOT_DIR))

    # 4. Install Playwright browser drivers
    print("\nInstalling Playwright headless browsers...")
    run_cmd(["playwright", "install", "chromium"], cwd=str(ROOT_DIR))

    print("\n" + "=" * 60)
    print("Setup complete! Start Atlas development environment by running:")
    print("  npm run dev")
    print("=" * 60)


if __name__ == "__main__":
    main()
