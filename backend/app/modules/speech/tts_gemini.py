import asyncio
import base64
import logging
import uuid
import wave
from pathlib import Path

from google import genai
from google.genai import types

from app.config import settings
from app.modules.speech.base import BaseTTS

logger = logging.getLogger(__name__)


class GeminiTTS(BaseTTS):
    """Gemini TTS через официальный пакет google-genai."""

    def __init__(self):
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY не задан")
        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def synthesize(self, text: str) -> str:
        if not text.strip():
            return ""

        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=settings.gemini_tts_model,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=settings.gemini_tts_voice,
                        )
                    )
                ),
            ),
        )

        encoded_audio = self._extract_audio(response)
        if not encoded_audio:
            raise ValueError("Gemini TTS не вернул аудиоданные")

        audio = base64.b64decode(encoded_audio) if isinstance(encoded_audio, str) else encoded_audio
        file_path = Path(settings.audio_cache_dir) / f"tts_{uuid.uuid4().hex[:10]}.wav"
        if audio[:4] == b"RIFF":
            file_path.write_bytes(audio)
        else:
            self._write_pcm_wav(file_path, audio)
        logger.info("Gemini TTS -> %s", file_path)
        return str(file_path)

    @staticmethod
    def _extract_audio(response) -> bytes | str | None:
        """Извлекает inline audio из ответа SDK, не полагаясь на REST-формат."""
        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", None) or []:
                inline_data = getattr(part, "inline_data", None)
                data = getattr(inline_data, "data", None)
                if data:
                    return data
        return None

    @staticmethod
    def _write_pcm_wav(path: Path, audio: bytes) -> None:
        with wave.open(str(path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(24000)
            output.writeframes(audio)
