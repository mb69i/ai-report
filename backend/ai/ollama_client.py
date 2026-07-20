"""Atlas Backend – Ollama Local LLM Client (offline fallback)"""

import json
from typing import List, Optional
import httpx
from loguru import logger


class OllamaClient:
    """
    Client for local Ollama LLM server.
    Used as fallback when Gemini is unavailable or offline mode is enabled.
    """

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        logger.info(f"Ollama client initialized: {base_url} model={model}")

    async def chat(
        self,
        message: str,
        system: str = "",
        history: Optional[List[dict]] = None,
    ) -> str:
        """Send a chat message to Ollama and return response text."""
        messages = []

        if system:
            messages.append({"role": "system", "content": system})

        if history:
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 2048,
            }
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")

    async def is_available(self) -> bool:
        """Check if Ollama server is running."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False
