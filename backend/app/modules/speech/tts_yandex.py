import logging
import uuid
from pathlib import Path

import httpx

from app.config import settings
from app.modules.speech.base import BaseTTS

logger = logging.getLogger(__name__)


class YandexSpeechTTS(BaseTTS):
    """Yandex SpeechKit синтез речи через HTTP API."""

    url = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

    def __init__(self):
        if not settings.yandex_api_key:
            raise ValueError("YANDEX_API_KEY не задан")
        if not settings.yandex_folder_id:
            raise ValueError("YANDEX_FOLDER_ID не задан")

    async def synthesize(self, text: str) -> str:
        if not text.strip():
            return ""

        form = {
            "text": text,
            "lang": "ru-RU",
            "voice": settings.yandex_tts_voice,
            "folderId": settings.yandex_folder_id,
            "format": settings.yandex_tts_format,
            "speed": settings.yandex_tts_speed,
        }
        if settings.yandex_tts_format == "lpcm":
            form["sampleRateHertz"] = "48000"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.url,
                headers={"Authorization": f"Api-Key {settings.yandex_api_key}"},
                data=form,
                timeout=45.0,
            )
            if response.is_error:
                logger.error(
                    "Yandex SpeechKit error: %s %s: %s",
                    response.status_code,
                    response.reason_phrase,
                    response.text[:500],
                )
                response.raise_for_status()

        extension = ".ogg" if settings.yandex_tts_format == "oggopus" else ".wav"
        file_path = Path(settings.audio_cache_dir) / f"tts_{uuid.uuid4().hex[:10]}{extension}"
        file_path.write_bytes(response.content)
        logger.info("Yandex SpeechKit TTS -> %s", file_path)
        return str(file_path)
