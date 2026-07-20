"""
Atlas Backend – Live Workflow Recorder

Launches a real visible browser window (Playwright/Chromium) and injects
JavaScript to capture every user interaction:
  - Navigation (URL changes)
  - Clicks (with element text and best CSS selector)
  - Keyboard fills (final value when input loses focus / changes)
  - Select / dropdown changes
  - Enter key presses (form submission shortcuts)

Events are stored in an async queue for real-time SSE streaming AND in a list
for the final generate-workflow call. Password fields are automatically redacted.
"""

import asyncio
import time
import uuid
from typing import Optional
from loguru import logger


# ── Event capture JS injected into every page ─────────────────────────────────

_CAPTURE_SCRIPT = """
(function () {
    // ── Best selector: strongly prefers ID/name/aria, then TEXT, then CSS ────────
    function bestSel(el) {
        if (!el || el === document.body || el === document.documentElement) return '';
        // 1. Unique ID
        if (el.id) return '#' + CSS.escape(el.id);
        // 2. data-testid / name / aria-label (unique attributes)
        var dt = el.getAttribute('data-testid');
        if (dt) return '[data-testid="' + CSS.escape(dt) + '"]';
        var nm = el.getAttribute('name');
        if (nm) return '[name="' + CSS.escape(nm) + '"]';
        var al = el.getAttribute('aria-label');
        if (al) return '[aria-label="' + al.replace(/"/g, '\\\\"') + '"]';
        // 3. For buttons/links with short visible text → use text= selector (most reliable!)
        var tag = el.tagName.toLowerCase();
        var txt = (el.innerText || el.textContent || '').trim();
        if ((tag === 'button' || tag === 'a') && txt && txt.length < 40 && txt.length > 0) {
            return 'text=' + txt;
        }
        // 4. Walk up to find nearest button/link parent with text
        var p = el.parentElement;
        var depth = 0;
        while (p && p !== document.body && depth < 4) {
            var ptxt = (p.innerText || p.textContent || '').trim();
            var ptag = p.tagName.toLowerCase();
            if ((ptag === 'button' || ptag === 'a') && ptxt && ptxt.length < 40) {
                return 'text=' + ptxt;
            }
            p = p.parentElement;
            depth++;
        }
        // 5. Fallback: simple CSS class (limited to first class only)
        var cls = typeof el.className === 'string'
            ? el.className.trim().split(/\\s+/).filter(Boolean)[0] || ''
            : '';
        if (cls) return tag + '.' + cls;
        return tag;
    }

    // ── Visible text helper ───────────────────────────────────────────────────
    function visibleText(el) {
        // Walk up to find meaningful text (for click identification)
        var t = el;
        var depth = 0;
        while (t && t !== document.body && depth < 5) {
            var txt = (t.innerText || t.textContent || '').trim().slice(0, 80);
            if (txt) return txt;
            t = t.parentElement;
            depth++;
        }
        return el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('value') || '';
    }

    // ── Label detector for fill events ────────────────────────────────────────
    function labelFor(el) {
        if (el.labels && el.labels.length > 0) {
            return el.labels[0].innerText.trim().slice(0, 60);
        }
        var ph = el.placeholder || el.getAttribute('aria-label') || '';
        if (ph) return ph.trim().slice(0, 60);
        var prev = el.previousElementSibling;
        if (prev && prev.innerText) return prev.innerText.trim().slice(0, 60);
        return '';
    }

    // ── Safe send to Python ────────────────────────────────────────────────────
    function send(evt) {
        try { window._atlasCapture(evt); } catch (_) {}
    }

    // ── Click ─────────────────────────────────────────────────────────────────
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || t.tagName === 'BODY' || t.tagName === 'HTML') return;
        // Skip plain inputs — they'll be captured as fills
        if (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'radio' && t.type !== 'submit' && t.type !== 'button') return;
        var sel = bestSel(t);
        var txt = visibleText(t).slice(0, 80);
        send({
            type: 'click',
            selector: sel,
            text: txt,
            tag: t.tagName.toLowerCase(),
            timestamp_ms: Date.now()
        });
    }, true);

    // ── Fill / Select (on change = final value after user finishes typing) ────
    document.addEventListener('change', function (e) {
        var t = e.target;
        if (!t) return;
        var tag = t.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
        var isPassword = t.type === 'password';
        send({
            type: tag === 'SELECT' ? 'select' : 'fill',
            selector: bestSel(t),
            value: isPassword ? '***REDACTED***' : t.value,
            label: labelFor(t),
            input_type: t.type || '',
            tag: tag.toLowerCase(),
            timestamp_ms: Date.now()
        });
    }, true);

    // ── Keyboard: track typing into inputs (live, for event feed display) ────
    document.addEventListener('input', function (e) {
        var t = e.target;
        if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
        if (t.type === 'password') return;  // Never capture password keystrokes live
        send({
            type: 'typing',
            selector: bestSel(t),
            value: t.value,
            label: labelFor(t),
            timestamp_ms: Date.now()
        });
    }, true);

    // ── Enter key (shortcut for form submission) ───────────────────────────────
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var t = e.target;
        if (!t) return;
        var tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') {
            send({
                type: 'key_enter',
                selector: bestSel(t),
                context: (t.value || t.innerText || '').trim().slice(0, 60),
                timestamp_ms: Date.now()
            });
        }
    }, true);
})();
"""


# ── Recording Session ──────────────────────────────────────────────────────────

class RecordingSession:
    """One active browser recording session."""

    def __init__(self, session_id: str, start_url: str, description: str):
        self.session_id = session_id
        self.start_url = start_url
        self.description = description
        self.events: list[dict] = []
        self.queue: asyncio.Queue = asyncio.Queue()
        self.status: str = "starting"   # starting | recording | stopped | error
        self._pw = None
        self._browser = None
        self._page = None

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Launch Chromium, inject listeners, navigate to start URL."""
        try:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=False,
                args=[
                    "--window-size=1280,900",
                    "--window-position=50,50",
                    "--disable-infobars",
                ]
            )
            self._page = await self._browser.new_page(
                viewport={"width": 1280, "height": 900}
            )

            # Track URL changes server-side
            self._page.on("framenavigated", self._on_navigation)

            # Expose Python handler to JavaScript
            await self._page.expose_function("_atlasCapture", self._on_js_event)

            # Inject comprehensive event capture (persists across same-page navigations)
            await self._page.add_init_script(_CAPTURE_SCRIPT)

            logger.info(f"[Recorder {self.session_id}] Opening browser → {self.start_url}")
            await self._page.goto(
                self.start_url,
                wait_until="domcontentloaded",
                timeout=30_000
            )
            self.status = "recording"
            logger.info(f"[Recorder {self.session_id}] Recording started ✓")

        except Exception as exc:
            self.status = "error"
            logger.error(f"[Recorder {self.session_id}] Failed to start: {exc}")
            await self._teardown()
            raise

    async def stop(self) -> list[dict]:
        """Stop the browser and return all captured events."""
        self.status = "stopped"
        events = list(self.events)
        await self._teardown()
        logger.info(f"[Recorder {self.session_id}] Stopped — {len(events)} events captured")
        return events

    async def _teardown(self) -> None:
        for obj in [self._browser, self._pw]:
            if obj:
                try:
                    await obj.close()
                except Exception:
                    pass

    # ── Event handlers ─────────────────────────────────────────────────────────

    def _on_navigation(self, frame) -> None:
        """Called by Playwright when the main frame navigates."""
        try:
            if self._page and frame == self._page.main_frame:
                url = frame.url
                if url and not url.startswith("about:") and not url.startswith("data:"):
                    self._push({
                        "type": "navigate",
                        "url": url,
                        "timestamp_ms": int(time.time() * 1000),
                    })
                    # Schedule a delayed table scan after page load
                    asyncio.create_task(self._delayed_table_scan())
        except Exception:
            pass

    async def _delayed_table_scan(self) -> None:
        """Scan the page after 2 seconds to auto-detect tables."""
        await asyncio.sleep(2.0)
        try:
            if not self._page or self.status != "recording":
                return

            js_code = """
            (() => {
                var tables = document.querySelectorAll('table');
                var results = [];
                tables.forEach((t, idx) => {
                    var rows = t.querySelectorAll('tr').length;
                    if (rows > 2) {
                        var ths = Array.from(t.querySelectorAll('th, tr:first-child td'))
                                      .map(h => (h.innerText || '').trim())
                                      .filter(Boolean)
                                      .slice(0, 10);
                        var sel = '';
                        if (t.id) {
                            sel = '#' + t.id;
                        } else {
                            sel = 'table:nth-of-type(' + (idx + 1) + ')';
                        }
                        results.push({
                            selector: sel,
                            rows: rows,
                            headers: ths
                        });
                    }
                });
                return results;
            })()
            """
            detected = await self._page.evaluate(js_code)
            for item in detected:
                self._push({
                    "type": "table_detected",
                    "selector": item["selector"],
                    "rows": item["rows"],
                    "headers": item["headers"],
                    "timestamp_ms": int(time.time() * 1000)
                })
                logger.info(f"Auto-detected table: {item['selector']} with {item['rows']} rows")
        except Exception as exc:
            logger.warning(f"Delayed table scan failed: {exc}")

    def _on_js_event(self, event: dict) -> None:
        """Called from the injected JavaScript via expose_function."""
        try:
            self._push(event)
        except Exception:
            pass

    def _push(self, event: dict) -> None:
        """Store event and notify the SSE queue."""
        self.events.append(event)
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


# ── Session Registry ───────────────────────────────────────────────────────────

_sessions: dict[str, RecordingSession] = {}


def get_session(session_id: str) -> Optional[RecordingSession]:
    return _sessions.get(session_id)


async def create_session(start_url: str, description: str) -> RecordingSession:
    session_id = str(uuid.uuid4())[:8]
    session = RecordingSession(session_id, start_url, description)
    _sessions[session_id] = session
    await session.start()
    return session


async def stop_session(session_id: str) -> list[dict]:
    session = _sessions.pop(session_id, None)
    if not session:
        raise ValueError(f"Recording session '{session_id}' not found.")
    return await session.stop()
