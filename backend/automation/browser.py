"""Atlas Backend – Browser Automation Wrapper (Playwright)"""

import asyncio
from pathlib import Path
from typing import Optional
from loguru import logger

from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright


ROOT_DIR = Path(__file__).parent.parent.parent


class AtlasBrowser:
    """
    Managed Playwright browser instance.

    Features:
    - Session persistence (saves/loads browser state)
    - Multi-tab support
    - Automatic crash recovery
    - Screenshot capture on errors
    - Configurable headless/headed mode
    """

    def __init__(self, config: dict = None):
        cfg = config or {}
        self._headless = cfg.get("headless", False)
        self._slow_mo = cfg.get("slow_mo_ms", 0)
        self._timeout = cfg.get("timeout_ms", 30000)
        self._session_dir = ROOT_DIR / cfg.get("session_dir", "data/sessions")
        self._download_dir = ROOT_DIR / cfg.get("download_dir", "data/downloads")
        self._user_data_dir = ROOT_DIR / cfg.get("user_data_dir", "data/browser_profile")
        self._screenshot_on_error = cfg.get("screenshot_on_error", True)

        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._pages: dict = {}          # name → Page
        self._active_page_key = "main"

        # Ensure directories exist
        self._session_dir.mkdir(parents=True, exist_ok=True)
        self._download_dir.mkdir(parents=True, exist_ok=True)
        self._user_data_dir.mkdir(parents=True, exist_ok=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Launch the browser and restore session if available."""
        if self._browser:
            return  # Already running

        self._playwright = await async_playwright().start()

        logger.info(f"Launching Chromium (headless={self._headless})")
        self._browser = await self._playwright.chromium.launch(
            headless=self._headless,
            slow_mo=self._slow_mo,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        # Try to load saved session state
        state_file = self._session_dir / "auth_state.json"
        storage_state = str(state_file) if state_file.exists() else None

        self._context = await self._browser.new_context(
            viewport={"width": 1366, "height": 768},
            accept_downloads=True,
            storage_state=storage_state,
        )

        # Set download path
        # NOTE: set_default_timeout is synchronous in Playwright — do NOT await it
        self._context.set_default_timeout(self._timeout)

        # Create initial page
        main_page = await self._context.new_page()
        self._pages["main"] = main_page
        self._active_page_key = "main"

        logger.info("Browser started.")

    async def stop(self) -> None:
        """Save session and close browser."""
        try:
            if self._context:
                state_file = self._session_dir / "auth_state.json"
                await self._context.storage_state(path=str(state_file))
                logger.info("Browser session saved.")
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception as e:
            logger.warning(f"Error during browser shutdown: {e}")
        finally:
            self._browser = None
            self._context = None
            self._pages = {}
            self._playwright = None

    async def restart(self) -> None:
        """Restart the browser (crash recovery)."""
        logger.warning("Restarting browser...")
        await self.stop()
        await asyncio.sleep(2)
        await self.start()

    # ── Page Management ───────────────────────────────────────────────────────

    async def get_active_page(self) -> Page:
        """Return the currently active page, starting browser if needed."""
        # If browser OR context is missing/dead, do a full (re)start
        if not self._browser or not self._context or not self._playwright:
            await self.start()
        page = self._pages.get(self._active_page_key)
        if not page or page.is_closed():
            # Context must exist here because start() was called above
            if not self._context:
                await self.start()
            page = await self._context.new_page()
            self._pages[self._active_page_key] = page
        return page

    async def new_tab(self, name: str = None) -> Page:
        """Open a new tab and return its Page object."""
        if not self._context:
            await self.start()
        page = await self._context.new_page()
        key = name or f"tab_{len(self._pages)}"
        self._pages[key] = page
        self._active_page_key = key
        return page

    async def switch_tab(self, name: str) -> Page:
        """Switch active tab by name."""
        if name not in self._pages:
            raise ValueError(f"Tab '{name}' not found. Available: {list(self._pages.keys())}")
        self._active_page_key = name
        return self._pages[name]

    async def close_tab(self, name: str) -> None:
        """Close a named tab."""
        page = self._pages.pop(name, None)
        if page and not page.is_closed():
            await page.close()
        if self._active_page_key == name:
            self._active_page_key = next(iter(self._pages), "main")

    # ── Convenience Actions ───────────────────────────────────────────────────

    async def screenshot(self, name: str = "screenshot") -> str:
        """Capture a screenshot of the active page."""
        from datetime import datetime
        screenshots_dir = ROOT_DIR / "data" / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        path = str(screenshots_dir / f"{name}_{ts}.png")
        page = await self.get_active_page()
        await page.screenshot(path=path, full_page=True)
        return path

    async def wait_for_navigation_idle(self, timeout_ms: int = 30000) -> None:
        """Wait for page to reach network idle state."""
        page = await self.get_active_page()
        await page.wait_for_load_state("networkidle", timeout=timeout_ms)

    async def evaluate(self, script: str):
        """Execute JavaScript in the active page context."""
        page = await self.get_active_page()
        return await page.evaluate(script)

    async def get_page_html(self) -> str:
        """Get the full HTML content of the active page."""
        page = await self.get_active_page()
        return await page.content()

    async def get_page_url(self) -> str:
        """Get current URL of the active page."""
        page = await self.get_active_page()
        return page.url

    async def get_page_title(self) -> str:
        page = await self.get_active_page()
        return await page.title()


# ── Singleton ─────────────────────────────────────────────────────────────────

_browser_instance: Optional[AtlasBrowser] = None


async def get_browser(config: dict = None) -> AtlasBrowser:
    """Get or create the shared browser instance."""
    global _browser_instance
    if _browser_instance is None:
        # Load config from atlas.config.json
        try:
            import json
            config_file = ROOT_DIR / "atlas.config.json"
            if config_file.exists():
                full_config = json.loads(config_file.read_text())
                config = full_config.get("browser", {})
        except Exception:
            config = {}
        _browser_instance = AtlasBrowser(config)
    # Check all three layers — playwright, browser, context must all be alive
    if not _browser_instance._playwright or not _browser_instance._browser or not _browser_instance._context:
        try:
            await _browser_instance.start()
        except Exception as e:
            # If start fails on a half-dead instance, recreate from scratch
            logger.warning(f"Browser start failed ({e}), recreating instance.")
            _browser_instance = AtlasBrowser(config or {})
            await _browser_instance.start()
    return _browser_instance


async def close_browser() -> None:
    global _browser_instance
    if _browser_instance:
        await _browser_instance.stop()
        _browser_instance = None
