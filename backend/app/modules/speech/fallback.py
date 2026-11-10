import logging
from typing import List

from app.modules.speech.base import BaseTTS

logger = logging.getLogger(__name__)


class FallbackTTS(BaseTTS):
    """Повторяет синтез на резервном TTS, не ломая ответ чат-бота."""

    def __init__(self, providers: List[BaseTTS]):
        self.providers = providers

    async def synthesize(self, text: str) -> str:
        last_error: Exception | None = None
        for index, provider in enumerate(self.providers):
            try:
                return await provider.synthesize(text)
            except Exception as exc:
                last_error = exc
                logger.exception("TTS provider %d failed; trying fallback", index + 1)
        raise RuntimeError("Все TTS-провайдеры недоступны") from last_error


class SilentTTS(BaseTTS):
    """Явно сообщает о недоступности всех настроенных TTS."""

    async def synthesize(self, text: str) -> str:
        raise RuntimeError("Все TTS-провайдеры не настроены или недоступны")
