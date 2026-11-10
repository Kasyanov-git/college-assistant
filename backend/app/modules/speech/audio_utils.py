# backend/app/modules/speech/audio_utils.py

"""
Утилиты для работы с аудио: парсинг WAV, конвертация форматов.
"""

import io
import wave
import struct
import logging
import subprocess
import tempfile
import os
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


def extract_pcm_from_wav(wav_bytes: bytes) -> Tuple[bytes, int]:
    """
    Извлечь сырые PCM-данные из WAV-файла.
    Возвращает: (pcm_bytes, sample_rate)
    """
    try:
        with wave.open(io.BytesIO(wav_bytes), 'rb') as wf:
            sample_rate = wf.getframerate()
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            n_frames = wf.getnframes()
            pcm_data = wf.readframes(n_frames)

            logger.debug(
                "WAV: %d Hz, %d ch, %d bit, %d frames, %.1f sec",
                sample_rate, n_channels, sample_width * 8,
                n_frames, n_frames / sample_rate,
            )

            # Если стерео — берём только левый канал
            if n_channels == 2:
                pcm_data = _stereo_to_mono(pcm_data, sample_width)

            return pcm_data, sample_rate

    except Exception as e:
        logger.error("Ошибка парсинга WAV: %s", e)
        raise


def _stereo_to_mono(pcm_data: bytes, sample_width: int) -> bytes:
    """Конвертация стерео → моно (берём среднее каналов)."""
    fmt = '<h' if sample_width == 2 else '<b'
    frame_size = sample_width * 2  # 2 канала
    mono_samples = []

    for i in range(0, len(pcm_data), frame_size):
        left = struct.unpack_from(fmt, pcm_data, i)[0]
        right = struct.unpack_from(fmt, pcm_data, i + sample_width)[0]
        mono_samples.append((left + right) // 2)

    return struct.pack(f'<{len(mono_samples)}h', *mono_samples)


def is_wav(data: bytes) -> bool:
    """Проверить, является ли файл WAV."""
    return len(data) > 44 and data[:4] == b'RIFF' and data[8:12] == b'WAVE'


def is_webm(data: bytes) -> bool:
    """Проверить, является ли файл WebM."""
    return len(data) > 4 and data[:4] == b'\x1a\x45\xdf\xa3'


def convert_webm_to_pcm(webm_bytes: bytes, target_rate: int = 16000) -> Optional[bytes]:
    """
    Конвертировать WebM/Opus → PCM WAV через ffmpeg.
    Fallback если фронтенд прислал не WAV.
    Требует установленного ffmpeg!
    """
    try:
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f_in:
            f_in.write(webm_bytes)
            in_path = f_in.name

        out_path = in_path.replace('.webm', '.wav')

        result = subprocess.run(
            [
                'ffmpeg', '-y',
                '-i', in_path,
                '-ar', str(target_rate),
                '-ac', '1',
                '-f', 'wav',
                '-acodec', 'pcm_s16le',
                out_path,
            ],
            capture_output=True,
            timeout=10,
        )

        if result.returncode != 0:
            logger.error("ffmpeg error: %s", result.stderr.decode(errors='ignore'))
            return None

        with open(out_path, 'rb') as f_out:
            wav_data = f_out.read()

        return wav_data

    except FileNotFoundError:
        logger.error("ffmpeg не установлен! Установите: apt install ffmpeg / brew install ffmpeg / choco install ffmpeg")
        return None
    except Exception as e:
        logger.error("Ошибка конвертации: %s", e)
        return None
    finally:
        for p in [in_path, out_path]:
            try:
                os.unlink(p)
            except Exception:
                pass


def ensure_pcm_wav(audio_bytes: bytes, target_rate: int = 16000) -> Tuple[Optional[bytes], int]:
    """
    Гарантировать, что аудио — это PCM данные, готовые для Vosk.
    Обрабатывает WAV и WebM форматы.
    Возвращает: (pcm_bytes, sample_rate) или (None, 0)
    """
    if is_wav(audio_bytes):
        logger.debug("Формат: WAV")
        return extract_pcm_from_wav(audio_bytes)

    if is_webm(audio_bytes):
        logger.debug("Формат: WebM → конвертируем через ffmpeg")
        wav_data = convert_webm_to_pcm(audio_bytes, target_rate)
        if wav_data:
            return extract_pcm_from_wav(wav_data)
        return None, 0

    # Попробуем как сырой PCM
    logger.debug("Неизвестный формат (%d bytes, header: %s), пробуем как raw PCM",
                 len(audio_bytes), audio_bytes[:4].hex())
    return audio_bytes, target_rate