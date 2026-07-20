"""
Atlas Backend – Workflow Engine (Core)

Responsible for executing a workflow definition step by step.
Each step type is dispatched to the browser automation layer.
Supports checkpoint/resume for crash recovery.
"""

import json
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, AsyncGenerator, Callable
from enum import Enum

from loguru import logger
from sqlmodel import Session

from storage.database import ExecutionRecord, StepRecord, WorkflowRecord
from sqlmodel import select


class StepType(str, Enum):
    NAVIGATE = "navigate"
    CLICK = "click"
    FILL = "fill"
    SELECT = "select"
    WAIT = "wait"
    SCROLL = "scroll"
    EXTRACT_TEXT = "extract_text"
    EXTRACT_TABLE = "extract_table"
    EXTRACT_METADATA = "extract_metadata"
    SCREENSHOT = "screenshot"
    DOWNLOAD = "download"
    LOOP = "loop"
    CONDITION = "condition"
    STORE = "store"
    SLEEP = "sleep"
    KEYBOARD = "keyboard"
    HOVER = "hover"
    FOR_EACH_ROW = "for_each_row"


class WorkflowEngine:
    """
    Executes a workflow definition JSON step by step.

    Usage:
        engine = WorkflowEngine(db_session)
        async for event in engine.execute(workflow_def, inputs, execution_id):
            send_to_ui(event)
    """

    def __init__(self, db_session: Session):
        self.session = db_session
        self._browser = None
        self._cancelled = False
        self._context: dict = {}   # Shared data between steps

    # ── Public API ────────────────────────────────────────────────────────────

    async def execute(
        self,
        workflow_def: dict,
        inputs: dict,
        execution_id: str,
        progress_callback: Optional[Callable] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Execute a workflow. Yields progress events as they happen.
        Events are dicts with {type, step_id, message, data}.
        """
        steps = workflow_def.get("steps", [])
        total = len(steps)

        # Initialize execution context with user inputs
        self._context = {"inputs": inputs, "outputs": {}}
        self._cancelled = False

        yield self._event("execution_started", message=f"Starting workflow: {workflow_def.get('name')}", data={"total_steps": total})

        # Always get a fresh/validated browser reference at execution start.
        # get_browser() checks all three layers (playwright, browser, context)
        # and auto-restarts any dead layer before returning.
        from automation.browser import get_browser
        self._browser = await get_browser()

        completed = 0
        for i, step in enumerate(steps):
            if self._cancelled:
                yield self._event("cancelled", message="Workflow cancelled by user.")
                break

            step_id = step.get("id", f"step_{i}")
            step_type = step.get("type", "")
            description = step.get("description", f"Step {i + 1}: {step_type}")

            yield self._event("step_started", step_id=step_id, message=description, data={
                "step_index": i,
                "total": total,
                "percent": int((i / total) * 100),
            })

            # Update DB step record
            self._update_step_db(execution_id, step_id, i, step_type, description, "running")

            try:
                result = await self._execute_step(step)
                completed += 1

                self._update_step_db(execution_id, step_id, i, step_type, description, "completed", result)
                yield self._event("step_completed", step_id=step_id, message=f"✓ {description}", data={
                    "result": result,
                    "step_index": i,
                    "percent": int(((i + 1) / total) * 100),
                })

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Step {step_id} failed: {error_msg}")
                self._update_step_db(execution_id, step_id, i, step_type, description, "failed", error=error_msg)

                retry = step.get("retry", 0)
                if retry > 0:
                    yield self._event("step_retrying", step_id=step_id, message=f"Retrying {step_id}...")
                    # Simple retry logic
                    for attempt in range(retry):
                        try:
                            await asyncio.sleep(2)
                            result = await self._execute_step(step)
                            completed += 1
                            self._update_step_db(execution_id, step_id, i, step_type, description, "completed", result)
                            yield self._event("step_completed", step_id=step_id, message=f"✓ {description} (retry {attempt+1})")
                            break
                        except Exception as retry_err:
                            if attempt == retry - 1:
                                self._update_step_db(execution_id, step_id, i, step_type, description, "failed", error=str(retry_err))
                                if step.get("on_failure") == "continue":
                                    yield self._event("step_skipped", step_id=step_id, message=f"Skipped failed step: {step_id}")
                                else:
                                    yield self._event("execution_failed", message=f"Workflow failed at step: {step_id}", data={"error": error_msg})
                                    return
                else:
                    if step.get("on_failure") == "continue":
                        yield self._event("step_skipped", step_id=step_id, message=f"Skipped failed step: {step_id}")
                    else:
                        yield self._event("execution_failed", message=f"Workflow failed at step: {step_id}", data={"error": error_msg})
                        return

        yield self._event("execution_completed", message=f"Workflow completed. {completed}/{total} steps successful.", data={
            "outputs": self._context.get("outputs", {}),
            "steps_completed": completed,
            "steps_total": total,
        })

    def cancel(self):
        """Signal the engine to stop after the current step."""
        self._cancelled = True

    # ── Step Dispatcher ───────────────────────────────────────────────────────

    async def _execute_step(self, step: dict) -> dict:
        """Dispatch step to the correct handler based on step type."""
        step_type = step.get("type", "")
        resolved = self._resolve_values(step)

        # Automatic login bypass: if we're already logged in, skip login-only steps
        try:
            page = await self._browser.get_active_page()
            if page and ("wms-central" in page.url or "storage" in page.url):
                step_id = resolved.get("id", "").lower()
                selector = str(resolved.get("selector", "")).lower()
                login_keywords = ["login", "password", "username", "maysquare", "organization", "credential"]
                if any(kw in step_id or kw in selector for kw in login_keywords) and step_type != StepType.NAVIGATE:
                    logger.info(f"Auto-bypassing login step '{resolved.get('id')}' (session already active on {page.url})")
                    return {"skipped": True, "reason": "already_logged_in"}
        except Exception:
            pass

        handlers = {
            StepType.NAVIGATE:         self._step_navigate,
            StepType.CLICK:            self._step_click,
            StepType.FILL:             self._step_fill,
            StepType.SELECT:           self._step_select,
            StepType.WAIT:             self._step_wait,
            StepType.SCROLL:           self._step_scroll,
            StepType.EXTRACT_TEXT:     self._step_extract_text,
            StepType.EXTRACT_TABLE:    self._step_extract_table,
            StepType.EXTRACT_METADATA: self._step_extract_metadata,
            StepType.SCREENSHOT:       self._step_screenshot,
            StepType.DOWNLOAD:         self._step_download,
            StepType.SLEEP:            self._step_sleep,
            StepType.KEYBOARD:         self._step_keyboard,
            StepType.HOVER:            self._step_hover,
            StepType.STORE:            self._step_store,
            StepType.FOR_EACH_ROW:     self._step_for_each_row,
        }

        handler = handlers.get(step_type)
        if not handler:
            raise ValueError(f"Unknown step type: {step_type}")

        result = await handler(resolved)

        # Honor wait_after_ms — pause after any step if requested
        wait_after = resolved.get("wait_after_ms")
        if wait_after and isinstance(wait_after, (int, float)) and wait_after > 0:
            await asyncio.sleep(wait_after / 1000)

        return result

    # ── Step Handlers ─────────────────────────────────────────────────────────

    async def _step_navigate(self, step: dict) -> dict:
        url = step.get("url", "")
        wait_for = step.get("wait_for")
        reload = step.get("reload", False)
        timeout = step.get("timeout_ms", 30000)
        page = await self._browser.get_active_page()

        if reload and page.url == url:
            # Hard reload — forces page to reset all filter/form state
            await page.reload(timeout=timeout, wait_until="domcontentloaded")
        else:
            await page.goto(url, timeout=timeout, wait_until="domcontentloaded")

        if wait_for:
            if wait_for.startswith("selector:"):
                selector = wait_for.split("selector:", 1)[1]
                await page.wait_for_selector(selector, timeout=timeout)
            elif wait_for == "networkidle":
                await page.wait_for_load_state("networkidle", timeout=timeout)
            else:
                await page.wait_for_timeout(int(wait_for))
        return {"url": url, "title": await page.title()}

    async def _step_click(self, step: dict) -> dict:
        raw_selector = step["selector"]
        force = step.get("force", False)
        timeout = step.get("timeout_ms", 10000)
        page = await self._browser.get_active_page()

        async def _do_click(locator):
            """Click via locator, with force fallback."""
            if force:
                el = await locator.element_handle(timeout=timeout)
                if el:
                    await el.dispatch_event("click")
                    return
            await locator.click(timeout=timeout)

        # Support comma-separated fallback selectors (try each in order)
        candidates = [s.strip() for s in raw_selector.split(",") if s.strip()]

        for sel in candidates:
            try:
                # text= selector → use Playwright's built-in text locator (most reliable)
                if sel.startswith("text="):
                    txt = sel[5:]
                    loc = page.get_by_text(txt, exact=True)
                    count = await loc.count()
                    if count == 0:
                        loc = page.get_by_text(txt, exact=False)
                        count = await loc.count()
                    if count > 0:
                        await _do_click(loc.first)
                        return {"clicked": sel}

                # aria-label= selector → use get_by_label
                elif sel.startswith("[aria-label="):
                    label = sel.split('"')[1] if '"' in sel else sel
                    loc = page.get_by_label(label)
                    if await loc.count() > 0:
                        await _do_click(loc.first)
                        return {"clicked": sel}

                # Standard CSS selector
                else:
                    el = await page.query_selector(sel)
                    if el:
                        if force:
                            await el.dispatch_event("click")
                        else:
                            await page.click(sel, timeout=timeout)
                        return {"clicked": sel}
            except Exception:
                pass

        # Last resort: try the first candidate directly with force
        try:
            sel0 = candidates[0]
            if sel0.startswith("text="):
                loc = page.get_by_text(sel0[5:], exact=False).first
                await loc.dispatch_event("click")
            else:
                el = await page.query_selector(sel0)
                if el:
                    await el.dispatch_event("click")
                else:
                    await page.click(sel0, timeout=timeout)
            return {"clicked": sel0}
        except Exception as e:
            raise Exception(f"Click failed for all selectors [{raw_selector}]: {e}") from e


    async def _step_fill(self, step: dict) -> dict:
        selector = step["selector"]
        value = str(step.get("value", ""))
        clear_first = step.get("clear_first", True)
        delay_ms = step.get("delay_ms", 30)
        page = await self._browser.get_active_page()

        # Click the field first to ensure focus
        await page.click(selector)
        await asyncio.sleep(0.1)

        if clear_first:
            # React/Ant Design controlled inputs ignore plain fill('').
            # Use keyboard sequence: triple-click selects all, then Delete clears.
            await page.keyboard.press("Control+a")
            await asyncio.sleep(0.05)
            await page.keyboard.press("Delete")
            await asyncio.sleep(0.05)
            # Also try fill('') as a fallback for non-React inputs
            try:
                await page.fill(selector, "")
            except Exception:
                pass
            await asyncio.sleep(0.05)

        # Type character by character so React onChange fires on each keystroke
        await page.type(selector, value, delay=delay_ms)
        return {"filled": selector, "value": value}

    async def _step_select(self, step: dict) -> dict:
        selector = step["selector"]
        value = step.get("value")
        label = step.get("label")
        page = await self._browser.get_active_page()
        if label:
            await page.select_option(selector, label=label)
        else:
            await page.select_option(selector, value=value)
        return {"selected": selector}

    async def _step_wait(self, step: dict) -> dict:
        selector = step.get("selector")
        state = step.get("state", "visible")
        timeout = step.get("timeout_ms", 30000)
        page = await self._browser.get_active_page()
        if selector:
            await page.wait_for_selector(selector, state=state, timeout=timeout)
        else:
            await page.wait_for_load_state(step.get("load_state", "networkidle"), timeout=timeout)
        return {"waited": selector or "load_state"}

    async def _step_scroll(self, step: dict) -> dict:
        direction = step.get("direction", "down")
        amount = step.get("amount", 500)
        page = await self._browser.get_active_page()
        if direction == "down":
            await page.evaluate(f"window.scrollBy(0, {amount})")
        elif direction == "up":
            await page.evaluate(f"window.scrollBy(0, -{amount})")
        elif direction == "bottom":
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        return {"scrolled": direction}

    async def _step_extract_text(self, step: dict) -> dict:
        from extractors.text_extractor import TextExtractor
        selector = step.get("selector", "body")
        output_key = step.get("output_key", "extracted_text")
        page = await self._browser.get_active_page()
        extractor = TextExtractor()
        text = await extractor.extract(page, selector)
        self._context["outputs"][output_key] = text
        return {"output_key": output_key, "length": len(text)}

    async def _step_extract_table(self, step: dict) -> dict:
        from extractors.table_extractor import TableExtractor
        selector = step.get("selector", "table")
        output_key = step.get("output_key", "extracted_table")
        page = await self._browser.get_active_page()
        extractor = TableExtractor()
        rows = await extractor.extract(page, selector)
        self._context["outputs"][output_key] = rows
        return {"output_key": output_key, "rows": len(rows)}

    async def _step_extract_metadata(self, step: dict) -> dict:
        from extractors.metadata_extractor import MetadataExtractor
        output_key = step.get("output_key", "page_metadata")
        page = await self._browser.get_active_page()
        extractor = MetadataExtractor()
        meta = await extractor.extract(page)
        self._context["outputs"][output_key] = meta
        return {"output_key": output_key}

    async def _step_screenshot(self, step: dict) -> dict:
        path = step.get("path", f"screenshots/screenshot_{uuid.uuid4().hex[:8]}.png")
        page = await self._browser.get_active_page()
        await page.screenshot(path=path, full_page=step.get("full_page", False))
        return {"screenshot": path}

    async def _step_download(self, step: dict) -> dict:
        selector = step["selector"]
        output_key = step.get("output_key", "downloaded_file")
        page = await self._browser.get_active_page()
        async with page.expect_download() as download_info:
            await page.click(selector)
        download = await download_info.value
        save_path = f"data/downloads/{download.suggested_filename}"
        await download.save_as(save_path)
        self._context["outputs"][output_key] = save_path
        return {"file": save_path}

    async def _step_sleep(self, step: dict) -> dict:
        ms = step.get("ms", 1000)
        await asyncio.sleep(ms / 1000)
        return {"slept_ms": ms}

    async def _step_keyboard(self, step: dict) -> dict:
        key = step["key"]
        page = await self._browser.get_active_page()
        await page.keyboard.press(key)
        return {"key": key}

    async def _step_hover(self, step: dict) -> dict:
        selector = step["selector"]
        page = await self._browser.get_active_page()
        await page.hover(selector)
        return {"hovered": selector}

    async def _step_store(self, step: dict) -> dict:
        key = step["key"]
        value = step.get("value") or self._context["outputs"].get(step.get("from_output", ""))
        self._context["outputs"][key] = value
        return {"stored": key}

    async def _step_for_each_row(self, step: dict) -> dict:
        from extractors.excel_reader import ExcelReader
        source_file = step.get("source")
        input_var = step.get("input_var", "item")
        loop_column = step.get("column")
        collect_key = step.get("collect_output_key", "extracted_table")
        output_key = step.get("output_key", "results")
        inner_steps = step.get("steps", [])

        if not source_file:
            raise ValueError("for_each_row step requires a 'source' file path.")

        # Read rows
        rows = ExcelReader.read_file(source_file)
        logger.info(f"Looping over {len(rows)} rows from {source_file}")

        combined_results = []
        outer_inputs = dict(self._context["inputs"])

        for idx, row in enumerate(rows):
            if self._cancelled:
                break

            # Find cell value for loop_column
            cell_value = row.get(loop_column)
            if cell_value is None:
                # Case-insensitive header match fallback
                matched = False
                for k, v in row.items():
                    if k.strip().lower() == str(loop_column).strip().lower():
                        cell_value = v
                        matched = True
                        break
                if not matched and row:
                    # Default to first column cell value
                    cell_value = list(row.values())[0]

            logger.info(f"Iteration {idx+1}/{len(rows)}: {input_var}={cell_value}")

            # Inject iteration loop values
            self._context["inputs"][input_var] = cell_value
            self._context["inputs"]["row"] = row

            # Run nested steps — respect each step's on_failure setting
            row_failed = False
            for inner_step in inner_steps:
                if self._cancelled:
                    break
                resolved = self._resolve_values(inner_step)
                on_fail = resolved.get("on_failure", "continue")
                try:
                    await self._execute_step(inner_step)
                except Exception as inner_exc:
                    logger.warning(
                        f"[Loop row {idx+1}] Step '{inner_step.get('id')}' failed: {inner_exc}"
                    )
                    if on_fail == "stop":
                        row_failed = True
                        break  # Skip remaining steps for this row, continue next row
                    # on_failure == "continue": just log and move to next inner step

            # Collect results from this iteration
            iteration_output = self._context["outputs"].get(collect_key, [])
            if isinstance(iteration_output, list):
                for row_item in iteration_output:
                    if isinstance(row_item, dict):
                        row_item["_loop_input"] = cell_value
                combined_results.extend(iteration_output)
            elif isinstance(iteration_output, dict):
                iteration_output["_loop_input"] = cell_value
                combined_results.append(iteration_output)

        # Restore context
        self._context["inputs"] = outer_inputs
        self._context["outputs"][output_key] = combined_results

        return {
            "rows_processed": len(rows),
            "results_collected": len(combined_results),
            "output_key": output_key,
        }


    # ── Utilities ─────────────────────────────────────────────────────────────

    def _resolve_values(self, step: dict) -> dict:
        """
        Replace template variables like {inputs.date} and {outputs.some_key}
        in step definition with actual runtime values.
        """
        def resolve(val):
            if not isinstance(val, str):
                return val
            try:
                return val.format(**{
                    "inputs": type("Inputs", (), self._context.get("inputs", {}))(),
                    "outputs": type("Outputs", (), self._context.get("outputs", {}))(),
                })
            except (KeyError, AttributeError):
                return val

        return {k: resolve(v) if not isinstance(v, dict) else v for k, v in step.items()}

    def _event(self, event_type: str, step_id: str = "", message: str = "", data: dict = None) -> dict:
        return {
            "type": event_type,
            "step_id": step_id,
            "message": message,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    def _update_step_db(self, execution_id: str, step_id: str, index: int,
                        step_type: str, description: str, status: str,
                        result: dict = None, error: str = None):
        """Upsert a step record in the database for progress tracking."""
        try:
            existing = self.session.exec(
                select(StepRecord)
                .where(StepRecord.execution_id == execution_id)
                .where(StepRecord.step_id == step_id)
            ).first()
            if existing:
                existing.status = status
                existing.error_message = error
                if result:
                    existing.result_json = json.dumps(result)
                if status == "running":
                    existing.started_at = datetime.utcnow()
                elif status in ("completed", "failed"):
                    existing.completed_at = datetime.utcnow()
                self.session.add(existing)
            else:
                record = StepRecord(
                    execution_id=execution_id,
                    step_id=step_id,
                    step_index=index,
                    step_type=step_type,
                    description=description,
                    status=status,
                    result_json=json.dumps(result or {}),
                    error_message=error,
                    started_at=datetime.utcnow() if status == "running" else None,
                )
                self.session.add(record)
            self.session.commit()
        except Exception as e:
            logger.warning(f"Failed to update step DB record: {e}")
