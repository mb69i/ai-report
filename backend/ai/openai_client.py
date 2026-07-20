"""Atlas Backend – OpenAI Client (GPT-4o, GPT-4-turbo, etc.)"""

import json
from typing import List, Optional
from loguru import logger


class OpenAIClient:
    """
    Thin wrapper around the OpenAI Python SDK for multi-turn chat.
    Supports any model accessible via the OpenAI API (GPT-4o, GPT-4-turbo, GPT-3.5-turbo).
    """

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        try:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=api_key)
        except ImportError:
            raise RuntimeError(
                "openai package not installed. Run: pip install openai"
            )
        self.model = model
        logger.info(f"OpenAI client initialized with model: {model}")

    async def chat(
        self,
        message: str,
        system: str = "",
        history: Optional[List[dict]] = None,
    ) -> str:
        """Send a chat message and return the response text."""
        messages = []

        if system:
            messages.append({"role": "system", "content": system})

        if history:
            for msg in history:
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["content"]})

        messages.append({"role": "user", "content": message})

        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=8192,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    async def is_available(self) -> bool:
        """Quick test to verify the API key and model are reachable."""
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
            )
            return bool(response.choices)
        except Exception:
            return False
