# backend/app/modules/speech/base.py

from abc import ABC, abstractmethod
from typing import AsyncIterator


class BaseSTT(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes) -> str:
        """Распознать речь из аудио-байтов (PCM16 mono 16kHz или WAV)."""
        ...


class BaseTTS(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> str:
        """Синтезировать речь. Возвращает путь к файлу."""
        ...