"""Atlas Backend – Gemini AI Client"""

import json
from typing import List, Optional
import google.generativeai as genai
from loguru import logger


class GeminiQuotaError(Exception):
    """Raised when the Gemini API returns a 429 quota/rate-limit error."""
    pass


class GeminiClient:
    """
    Thin wrapper around the Google Gemini generative AI client.
    Handles multi-turn conversations with system prompts.

    Raises GeminiQuotaError on 429 so the orchestrator can fall through
    to the next provider gracefully instead of retrying the same key.
    """

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(
            model_name=model,
            generation_config={
                "temperature": 0.3,
                "top_p": 0.95,
                "max_output_tokens": 8192,
                "response_mime_type": "text/plain",
            }
        )
        logger.info(f"Gemini client initialized with model: {model}")

    async def chat(
        self,
        message: str,
        system: str = "",
        history: Optional[List[dict]] = None,
    ) -> str:
        """Send a message and return the AI response text."""
        try:
            # Build conversation for Gemini
            chat_history = []
            if history:
                for msg in history:
                    role = "user" if msg["role"] == "user" else "model"
                    chat_history.append({"role": role, "parts": [msg["content"]]})

            # Prepend system prompt to the first user message
            if system and not chat_history:
                full_message = f"{system}\n\n---\n\nUser: {message}"
            else:
                full_message = message

            chat = self.model.start_chat(history=chat_history)
            response = await chat.send_message_async(full_message)
            return response.text

        except Exception as e:
            err_str = str(e)
            # Detect quota / rate-limit errors (HTTP 429)
            if "429" in err_str or "quota" in err_str.lower() or "rate limit" in err_str.lower() or "rate_limit" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str:
                logger.warning(f"Gemini quota exceeded ({self.model_name}): {err_str[:120]}")
                raise GeminiQuotaError(f"Gemini quota exceeded: {err_str[:120]}")
            logger.error(f"Gemini API error: {e}")
            raise

    async def classify_intent(self, message: str, workflow_library: str) -> dict:
        """Quick intent classification without full conversation history."""
        prompt = f"""
Classify the intent of this user message for an automation platform.
Available workflows:
{workflow_library}

User message: "{message}"

Respond ONLY with valid JSON:
{{
  "intent": "run_workflow|list_workflows|create_workflow|ask_question|other",
  "workflow_id": "matching_workflow_id_or_null",
  "confidence": 0.0,
  "missing_inputs": [],
  "response": "Your response to the user",
  "plan": "What you plan to do"
}}
"""
        response = await self.chat(prompt)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"intent": "other", "workflow_id": None, "confidence": 0, "missing_inputs": [], "response": response, "plan": None}
