import logging
from typing import Dict, List

from app.modules.llm.base import BaseLLM, ChatMessage, LLMResponse

logger = logging.getLogger(__name__)


class FallbackLLM(BaseLLM):
    """Повторяет операции на следующей модели при ошибке API."""

    def __init__(self, providers: List[BaseLLM]):
        self.providers = providers

    async def generate(
        self,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> LLMResponse:
        last_error: Exception | None = None
        for index, provider in enumerate(self.providers):
            try:
                return await provider.generate(messages, temperature, max_tokens)
            except Exception as exc:
                last_error = exc
                logger.exception("LLM provider %d failed; trying fallback", index + 1)
        raise RuntimeError("Все LLM-провайдеры недоступны") from last_error

    async def classify_intent(self, user_text: str) -> Dict:
        last_error: Exception | None = None
        for index, provider in enumerate(self.providers):
            try:
                return await provider.classify_intent(user_text)
            except Exception as exc:
                last_error = exc
                logger.exception("LLM intent provider %d failed; trying fallback", index + 1)
        raise RuntimeError("Все LLM-провайдеры классификации недоступны") from last_error

    async def rewrite_query_with_context(
        self, user_text: str, history: List[ChatMessage]
    ) -> str:
        for provider in self.providers:
            rewrite = getattr(provider, "rewrite_query_with_context", None)
            if rewrite is None:
                continue
            try:
                return await rewrite(user_text, history)
            except Exception:
                logger.exception("LLM query rewrite failed; trying fallback")
        return user_text
