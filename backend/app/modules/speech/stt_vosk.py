# backend/app/modules/speech/stt_vosk.py

import json
import logging
from vosk import Model, KaldiRecognizer

from app.config import settings
from app.modules.speech.base import BaseSTT
from app.modules.speech.audio_utils import ensure_pcm_wav

logger = logging.getLogger(__name__)


class VoskSTT(BaseSTT):
    def __init__(self):
        logger.info("Загрузка Vosk модели: %s", settings.vosk_model_path)
        self.model = Model(settings.vosk_model_path)
        self.sample_rate = 16000
        logger.info("Vosk модель загружена")

    def transcribe(self, audio_bytes: bytes) -> str:
        if not audio_bytes or len(audio_bytes) < 100:
            logger.warning("Получен слишком короткий аудио-буфер: %d bytes", len(audio_bytes))
            return ""

        logger.info(
            "STT получено: %d bytes, header: %s",
            len(audio_bytes),
            audio_bytes[:12].hex(),
        )

        # Конвертируем в PCM (обрабатывает WAV, WebM и raw PCM)
        pcm_data, sample_rate = ensure_pcm_wav(audio_bytes, self.sample_rate)

        if pcm_data is None or len(pcm_data) == 0:
            logger.error("Не удалось извлечь PCM из аудио")
            return ""

        duration = len(pcm_data) / (sample_rate * 2)  # 16-bit = 2 bytes per sample
        logger.info("PCM: %d bytes, %d Hz, %.1f sec", len(pcm_data), sample_rate, duration)

        if duration < 0.3:
            logger.warning("Аудио слишком короткое: %.1f sec", duration)
            return ""

        # Распознавание через Vosk
        rec = KaldiRecognizer(self.model, sample_rate)
        rec.SetWords(False)

        # Подаём чанками по 4000 bytes для лучшей работы
        chunk_size = 4000
        for i in range(0, len(pcm_data), chunk_size):
            chunk = pcm_data[i:i + chunk_size]
            rec.AcceptWaveform(chunk)

        result = json.loads(rec.FinalResult())
        text = result.get("text", "").strip()

        logger.info("STT результат: '%s'", text if text else "(пусто)")
        return text