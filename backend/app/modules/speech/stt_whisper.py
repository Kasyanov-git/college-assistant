# backend/app/modules/speech/stt_whisper.py

import logging
import tempfile
import os
from app.modules.speech.base import BaseSTT
from app.config import settings
# from modules.speech.base import BaseSTT
# from config import settings

logger = logging.getLogger(__name__)


class WhisperSTT(BaseSTT):
    def __init__(self):
        try:
            from faster_whisper import WhisperModel
            logger.info("Загрузка faster-whisper модели: %s", settings.whisper_model_size)
            self.model = WhisperModel(
                settings.whisper_model_size,
                device="cpu",
                compute_type="int8"
            )
        except ImportError:
            import whisper
            logger.info("Загрузка whisper модели: %s", settings.whisper_model_size)
            self.model = whisper.load_model(settings.whisper_model_size)
            self._use_openai_whisper = True
        else:
            self._use_openai_whisper = False
        logger.info("Whisper модель загружена")

    def transcribe(self, audio_bytes: bytes) -> str:
        # Сохраняем во временный файл
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            if self._use_openai_whisper:
                result = self.model.transcribe(tmp_path, language="ru")
                text = result["text"].strip()
            else:
                segments, _ = self.model.transcribe(tmp_path, language="ru")
                text = " ".join(s.text for s in segments).strip()
        finally:
            os.unlink(tmp_path)

        logger.info("STT (whisper): '%s'", text)
        return text