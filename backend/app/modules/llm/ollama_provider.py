# backend/app/modules/llm/ollama_provider.py

import httpx
import json
import re
import logging
from typing import List, Dict

from app.modules.llm.base import BaseLLM, ChatMessage, LLMResponse
from app.modules.llm.prompts import INTENT_CLASSIFICATION_PROMPT
from app.config import settings
# from modules.llm.base import BaseLLM, ChatMessage, LLMResponse
# from modules.llm.prompts import INTENT_CLASSIFICATION_PROMPT
# from config import settings


logger = logging.getLogger(__name__)


class OllamaLLM(BaseLLM):
    """Локальный LLM через Ollama."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        logger.info("Ollama LLM: %s @ %s", self.model, self.base_url)

    async def generate(
        self,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()

        text = data["message"]["content"]
        logger.debug("Ollama → %s", text[:120])
        return LLMResponse(text=text)

    async def classify_intent(self, user_text: str) -> Dict:
        messages = [
            ChatMessage(role="system", content=INTENT_CLASSIFICATION_PROMPT),
            ChatMessage(role="user", content=user_text),
        ]
        response = await self.generate(messages, temperature=0.05, max_tokens=200)

        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            match = re.search(r'\{[^{}]*\}', response.text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return {"intent": "unknown", "entities": {}, "confidence": 0.0}