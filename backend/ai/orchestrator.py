"""
Atlas Backend – AI Orchestrator

The brain of Atlas:
1. Classifies user intent from natural language
2. Selects the correct workflow from the library
3. Identifies missing inputs and asks follow-up questions
4. Generates execution summaries and progress narratives

Supports three AI providers: Gemini, OpenAI, and Ollama.
Providers and models are hot-reloadable — no restart required after changing settings.

Fallback chain: if a provider fails with a quota/auth/connection error,
the orchestrator automatically tries the next one in the configured order.
"""

import json
import re
from pathlib import Path
from typing import Optional
from loguru import logger

from config.settings import get_settings, get_atlas_config

WORKFLOWS_DIR = Path(__file__).parent.parent.parent / "workflows"


SYSTEM_PROMPT = """
You are Atlas, an intelligent automation assistant. Your job is to help users run business workflows.

You have access to a library of workflows. When the user sends a message:
1. Determine their intent (run_workflow, list_workflows, create_workflow, ask_question, other)
2. If they want to run a workflow, identify which workflow matches their request
3. Check if all required inputs are provided
4. If inputs are missing, ask for them one at a time
5. Confirm your plan before executing (unless the user has disabled confirmations)
6. Provide clear progress updates and a summary when done

Be concise, professional, and helpful. Never reveal internal system details or API keys.

When selecting a workflow, consider the workflow name, description, and tags.
If no workflow matches, suggest creating a new one in Training Mode.

Current workflow library:
{workflow_library}

Response format for intent classification (JSON only — no markdown fences):
{{
  "intent": "run_workflow|list_workflows|create_workflow|ask_question|other",
  "workflow_id": "matched_workflow_id_or_null",
  "confidence": 0.0-1.0,
  "missing_inputs": ["list", "of", "missing", "input", "names"],
  "response": "Your natural language response to the user",
  "plan": "Brief description of what you plan to do (for run_workflow intent)"
}}
"""


def get_workflow_library_summary() -> str:
    """Build a summary of available workflows for the AI context."""
    summaries = []
    if not WORKFLOWS_DIR.exists():
        return "No workflows available yet."
    for wf_file in WORKFLOWS_DIR.glob("*.json"):
        try:
            data = json.loads(wf_file.read_text(encoding="utf-8"))
            tags = ", ".join(data.get("tags", []))
            inputs = [i.get("name") for i in data.get("required_inputs", [])]
            summaries.append(
                f"- ID: {data.get('id')} | Name: {data.get('name')} | "
                f"Description: {data.get('description')} | "
                f"Tags: {tags} | Required inputs: {', '.join(inputs) or 'none'}"
            )
        except Exception:
            pass
    return "\n".join(summaries) if summaries else "No workflows available yet."


class AIOrchestrator:
    """
    Manages the AI conversation and intent→workflow mapping.

    Providers (in priority order):
      1. Gemini  – Google cloud AI (primary default)
      2. OpenAI  – GPT-4o / GPT-4-turbo / GPT-3.5-turbo
      3. Ollama  – Local LLM fallback (offline mode)

    All provider/model settings are read fresh from config on every call
    so changes in the Settings page take effect immediately.
    """

    def __init__(self):
        self._conversation_history = []
        # Cached client instances — key is (provider, model) tuple
        self._clients: dict = {}

    # ── Client factories ───────────────────────────────────────────────────────

    def _make_gemini(self, api_key: str, model: str):
        key = ("gemini", api_key[:8], model)
        if key not in self._clients:
            from ai.gemini_client import GeminiClient
            self._clients[key] = GeminiClient(api_key, model)
        return self._clients[key]

    def _make_openai(self, api_key: str, model: str):
        key = ("openai", api_key[:8], model)
        if key not in self._clients:
            from ai.openai_client import OpenAIClient
            self._clients[key] = OpenAIClient(api_key, model)
        return self._clients[key]

    def _make_ollama(self, base_url: str, model: str):
        key = ("ollama", base_url, model)
        if key not in self._clients:
            from ai.ollama_client import OllamaClient
            self._clients[key] = OllamaClient(base_url, model)
        return self._clients[key]

    # ── Main chat entry point ──────────────────────────────────────────────────

    async def chat(self, user_message: str, session_id: str = "default") -> dict:
        """
        Process a user message and return a structured response.

        Provider selection order is determined by `primary_provider` in atlas.config.json.
        Always falls through to the next available provider on failure.
        """
        settings = get_settings()
        cfg = get_atlas_config()
        ai_cfg = cfg.get("ai", {})

        primary = ai_cfg.get("primary_provider", "gemini")
        offline = ai_cfg.get("offline_mode", False) or settings.offline_mode

        # Build provider attempt order
        if offline:
            order = ["ollama"]
        elif primary == "openai":
            order = ["openai", "gemini", "ollama"]
        elif primary == "ollama":
            order = ["ollama", "gemini", "openai"]
        else:
            order = ["gemini", "openai", "ollama"]

        workflow_library = get_workflow_library_summary()
        system = SYSTEM_PROMPT.format(workflow_library=workflow_library)

        self._conversation_history.append({"role": "user", "content": user_message})

        response_text = None
        provider_used = None

        for provider in order:
            try:
                if provider == "gemini":
                    api_key = settings.gemini_api_key
                    if not api_key:
                        continue
                    model = ai_cfg.get("gemini_model", "gemini-1.5-flash")
                    client = self._make_gemini(api_key, model)
                    try:
                        response_text = await client.chat(
                            system=system,
                            history=self._conversation_history[:-1],
                            message=user_message,
                        )
                    except Exception as gemini_err:
                        err_s = str(gemini_err)
                        # Check for 404/not found/not supported
                        if "404" in err_s or "not found" in err_s.lower() or "not supported" in err_s.lower():
                            logger.warning(f"Gemini model {model} not supported or not found. Attempting self-healing...")
                            try:
                                import google.generativeai as genai
                                genai.configure(api_key=api_key)
                                available = [
                                    m.name.replace("models/", "")
                                    for m in genai.list_models()
                                    if "generateContent" in m.supported_generation_methods
                                ]
                                if available:
                                    # Pick the best working model based on preferred order, avoiding deprecated ones
                                    preferred_order = [
                                        "gemini-3.5-flash",
                                        "gemini-3.1-flash-lite",
                                        "gemini-2.0-flash",
                                        "gemini-2.0-flash-lite",
                                        "gemini-2.5-flash",
                                        "gemini-1.5-flash",
                                        "gemini-2.5-pro",
                                        "gemini-1.5-pro",
                                    ]
                                    new_model = next(
                                        (m for m in preferred_order if m in available),
                                        available[0]
                                    )
                                    logger.info(f"Self-healed: switching Gemini model from {model} to {new_model}")
                                    
                                    # Update config file
                                    from config.settings import save_atlas_config
                                    save_atlas_config({
                                        **cfg,
                                        "ai": {
                                            **ai_cfg,
                                            "gemini_model": new_model
                                        }
                                    })
                                    
                                    # Retry with the new model
                                    model = new_model
                                    client = self._make_gemini(api_key, model)
                                    response_text = await client.chat(
                                        system=system,
                                        history=self._conversation_history[:-1],
                                        message=user_message,
                                    )
                                    provider_used = f"gemini/{model}"
                                    break
                            except Exception as heal_err:
                                logger.error(f"Gemini self-healing failed: {heal_err}")
                        
                        # Check for quota error — fall through to next provider
                        if "429" in err_s or "quota" in err_s.lower() or "RESOURCE_EXHAUSTED" in err_s:
                            logger.warning("Gemini quota exceeded — trying next provider")
                            continue
                        raise
                    provider_used = f"gemini/{model}"

                elif provider == "openai":
                    api_key = settings.openai_api_key
                    if not api_key:
                        continue
                    model = ai_cfg.get("openai_model", "gpt-4o")
                    client = self._make_openai(api_key, model)
                    response_text = await client.chat(
                        system=system,
                        history=self._conversation_history[:-1],
                        message=user_message,
                    )
                    provider_used = f"openai/{model}"

                elif provider == "ollama":
                    base_url = ai_cfg.get("ollama_base_url", settings.ollama_base_url)
                    model = ai_cfg.get("ollama_model", "llama3.2")
                    client = self._make_ollama(base_url, model)
                    response_text = await client.chat(
                        system=system,
                        history=self._conversation_history[:-1],
                        message=user_message,
                    )
                    provider_used = f"ollama/{model}"

                if response_text:
                    logger.info(f"AI response via {provider_used}")
                    break

            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}")
                continue

        # All providers failed
        if not response_text:
            logger.error("All AI providers failed — returning fallback response")
            response_text = json.dumps({
                "intent": "other",
                "workflow_id": None,
                "confidence": 0,
                "missing_inputs": [],
                "response": (
                    "⚠️ I can't reach any AI service right now.\n\n"
                    "**To fix this, go to ⚙️ Settings and:**\n"
                    "- Add a **Gemini API key** (free at aistudio.google.com), or\n"
                    "- Add an **OpenAI API key**, or\n"
                    "- Install **Ollama** locally for offline use."
                ),
                "plan": None,
            })
            provider_used = "fallback"

        parsed = self._parse_response(response_text)
        self._conversation_history.append({"role": "assistant", "content": response_text})

        # Trim history
        max_history = ai_cfg.get("max_conversation_history", 40)
        if len(self._conversation_history) > max_history:
            self._conversation_history = self._conversation_history[-max_history:]

        return {
            **parsed,
            "provider": provider_used,
            "raw_response": response_text,
        }

    def _parse_response(self, text: str) -> dict:
        """Extract JSON from AI response, with graceful fallback."""
        # Strip markdown fences if present
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON block from mixed text
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Return as plain response
        return {
            "intent": "other",
            "workflow_id": None,
            "confidence": 0,
            "missing_inputs": [],
            "response": text,
            "plan": None,
        }

    def clear_history(self):
        self._conversation_history = []

    async def generate_workflow_from_recording(
        self,
        events: list[dict],
        description: str,
    ) -> dict:
        """
        Send a captured browser event log to the AI and receive a structured
        workflow JSON ready to be saved and executed by Atlas.

        Reuses the same provider/fallback chain as the regular chat method.
        """
        settings = get_settings()
        cfg = get_atlas_config()
        ai_cfg = cfg.get("ai", {})

        primary = ai_cfg.get("primary_provider", "gemini")
        if primary == "openai":
            order = ["openai", "gemini", "ollama"]
        elif primary == "ollama":
            order = ["ollama", "gemini", "openai"]
        else:
            order = ["gemini", "openai", "ollama"]

        # ── Build readable event log ───────────────────────────────────────────
        lines = []
        for i, evt in enumerate(events, 1):
            t = evt.get("type", "")
            ts = evt.get("timestamp_ms", 0)
            if t == "navigate":
                lines.append(f"{i:03}. [NAVIGATE] → {evt.get('url', '')}")
            elif t == "click":
                text = evt.get("text", "")
                sel = evt.get("selector", "")
                lines.append(f"{i:03}. [CLICK]    selector={sel!r}  text={text!r}")
            elif t == "fill":
                sel = evt.get("selector", "")
                val = evt.get("value", "")
                lbl = evt.get("label", "")
                lines.append(f"{i:03}. [FILL]     selector={sel!r}  label={lbl!r}  value={val!r}")
            elif t == "select":
                sel = evt.get("selector", "")
                val = evt.get("value", "")
                lbl = evt.get("label", "")
                lines.append(f"{i:03}. [SELECT]   selector={sel!r}  label={lbl!r}  value={val!r}")
            elif t == "key_enter":
                sel = evt.get("selector", "")
                lines.append(f"{i:03}. [ENTER]    selector={sel!r}")
            elif t == "table_detected":
                sel = evt.get("selector", "")
                rows_cnt = evt.get("rows", 0)
                hdrs = ", ".join(evt.get("headers", []))
                lines.append(f"{i:03}. [TABLE_DETECTED] selector={sel!r} rows={rows_cnt} headers=[{hdrs}]")
            elif t == "typing":
                pass   # Skip intermediate typing — change events capture final value
        event_log = "\n".join(lines)

        # ── Workflow schema reference ──────────────────────────────────────────
        schema_example = json.dumps({
            "id": "snake_case_workflow_id",
            "name": "Human Readable Workflow Name",
            "description": "One-sentence description of what this workflow does.",
            "version": "1.0.0",
            "tags": ["tag1", "tag2"],
            "required_inputs": [
                {
                    "name": "date",
                    "type": "date",
                    "label": "Report Date",
                    "placeholder": "YYYY-MM-DD",
                    "required": True,
                    "default": "today"
                }
            ],
            "steps": [
                {
                    "id": "navigate_to_module",
                    "type": "navigate",
                    "description": "Open the target page",
                    "url": "https://example.com/path",
                    "on_failure": "stop"
                },
                {
                    "id": "fill_date",
                    "type": "fill",
                    "description": "Enter the report date",
                    "selector": "#date-input",
                    "value": "{inputs.date}",
                    "on_failure": "stop"
                },
                {
                    "id": "click_run",
                    "type": "click",
                    "description": "Submit the form",
                    "selector": "#run-button",
                    "wait_after_ms": 2000,
                    "on_failure": "stop"
                },
                {
                    "id": "wait_results",
                    "type": "wait",
                    "description": "Wait for results to load",
                    "selector": "table, .results",
                    "state": "visible",
                    "timeout_ms": 30000,
                    "on_failure": "continue"
                },
                {
                    "id": "extract_data",
                    "type": "extract_table",
                    "description": "Extract the results table",
                    "selector": "table",
                    "output_key": "results",
                    "on_failure": "continue"
                }
            ],
            "output": {
                "format": "excel",
                "primary_data_key": "results",
                "filename_pattern": "WorkflowName_{inputs.date}"
            },
            "validation": {"min_rows": 0}
        }, indent=2)

        prompt = f"""You are an expert automation engineer analyzing a browser session recording to create a reusable workflow for the Atlas automation platform.

The user described this workflow as:
"{description}"

## Recorded Browser Events (chronological)
{event_log}

## Your Task
Analyze these events and produce a complete workflow JSON. Rules:
1. **Identify runtime INPUTS** — any value the user types that would change per run (dates, IDs, task numbers, names, search terms) should become a required_input parameter using {{inputs.param_name}} template syntax. Hardcoded URLs and fixed button selectors are NOT inputs.
2. **Group into logical STEPS** — give each step a clear snake_case id and human-readable description.
3. **Skip [CLICK] events on INPUT fields** that are immediately followed by a [FILL] on the same selector — the fill captures the intent.
4. **Add wait steps** (type: "wait") after navigations and after clicking submit/search buttons to wait for content to load.
5. **Add extract_table step** if the recording shows the user landing on a page with data results.
6. **Use robust selectors** — if a button or link has visible text (e.g. text='Search' or selector='text=Search'), ALWAYS use the format `text=TEXT` for the selector (e.g. `text=Search`). Avoid using generic tag selectors like `span`, `a`, or `div` for buttons/links.
7. **Name the workflow** from the URL patterns + user description.
8. **on_failure**: use "stop" for critical steps (navigate, fill required fields) and "continue" for optional ones (screenshots, optional extracts).

## Output Schema
Return ONLY a valid JSON object matching this exact structure (no markdown, no explanation):
{schema_example}
"""

        # ── Try each provider ─────────────────────────────────────────────────
        raw = None
        for provider in order:
            try:
                if provider == "gemini":
                    api_key = settings.gemini_api_key
                    if not api_key:
                        continue
                    model = ai_cfg.get("gemini_model", "gemini-3.5-flash")
                    client = self._make_gemini(api_key, model)
                    raw = await client.chat(prompt, system="You are a JSON-only workflow generator. Output only valid JSON.")
                    break

                elif provider == "openai":
                    api_key = settings.openai_api_key
                    if not api_key:
                        continue
                    model = ai_cfg.get("openai_model", "gpt-4o")
                    client = self._make_openai(api_key, model)
                    raw = await client.chat(prompt, system="You are a JSON-only workflow generator. Output only valid JSON.")
                    break

                elif provider == "ollama":
                    model = ai_cfg.get("ollama_model", "llama3.2")
                    base_url = ai_cfg.get("ollama_base_url", "http://localhost:11434")
                    client = self._make_ollama(base_url, model)
                    raw = await client.chat(prompt, system="You are a JSON-only workflow generator. Output only valid JSON.")
                    break

            except Exception as exc:
                logger.warning(f"Workflow generation: provider {provider} failed — {exc}")
                continue

        if not raw:
            raise RuntimeError("All AI providers failed. Check your API keys in Settings.")

        # ── Parse the JSON response ────────────────────────────────────────────
        text = raw.strip()
        # Strip markdown code fences if present
        import re as _re
        text = _re.sub(r"^```(?:json)?\s*", "", text)
        text = _re.sub(r"\s*```$", "", text)
        text = text.strip()

        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting the outermost JSON object
        match = _re.search(r"\{.*\}", text, _re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        raise ValueError(f"AI returned non-JSON response:\n{text[:500]}")

    def generate_summary(self, execution_result: dict) -> str:
        """Generate a human-readable summary of a completed execution."""
        wf_name = execution_result.get("workflow_name", "workflow")
        steps = execution_result.get("steps_completed", 0)
        total = execution_result.get("steps_total", 0)
        outputs = execution_result.get("outputs", {})
        duration = execution_result.get("duration_seconds", 0)

        summary_parts = [
            f"✅ **{wf_name}** completed successfully.",
            f"- Steps: {steps}/{total}",
            f"- Duration: {duration:.1f}s",
        ]

        if outputs:
            for key, val in outputs.items():
                if isinstance(val, list):
                    summary_parts.append(f"- {key}: {len(val)} records extracted")
                elif isinstance(val, str) and len(val) < 200:
                    summary_parts.append(f"- {key}: {val}")

        return "\n".join(summary_parts)


# Singleton instance
_orchestrator: Optional[AIOrchestrator] = None


def get_orchestrator() -> AIOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AIOrchestrator()
    return _orchestrator
