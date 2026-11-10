# backend/app/config.py

from pydantic_settings import BaseSettings
from typing import Optional
from enum import Enum
import os


class LLMProvider(str, Enum):
    GIGACHAT = "gigachat"
    OLLAMA = "ollama"


class STTProvider(str, Enum):
    VOSK = "vosk"
    WHISPER = "whisper"


class TTSProvider(str, Enum):
    GEMINI = "gemini"
    YANDEX = "yandex"


class Settings(BaseSettings):
    app_name: str = "CollegeAssistant"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM
    llm_provider: LLMProvider = LLMProvider.GIGACHAT
    # Резерв пока намеренно дублирует основной провайдер. Замените на другую
    # модель/провайдер в .env после подключения резервной инфраструктуры.
    llm_fallback_provider: LLMProvider = LLMProvider.GIGACHAT
    gigachat_credentials: Optional[str] = None
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_model: str = "GigaChat-Max"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"

    # STT
    stt_provider: STTProvider = STTProvider.VOSK
    # vosk_model_path: str = "data/vosk_model/vosk-model-small-ru-0.22"
    vosk_model_path: str = "data/vosk_model/vosk-model-ru-0.42"
    whisper_model_size: str = "base"

    # TTS
    tts_provider: TTSProvider = TTSProvider.GEMINI
    tts_fallback_provider: TTSProvider = TTSProvider.YANDEX
    gemini_api_key: Optional[str] = None
    gemini_tts_model: str = "gemini-3.8-flash-tts"
    gemini_tts_voice: str = "Kore"
    gemini_tts_style: str = "Говори по-русски дружелюбно, спокойно и естественно."
    yandex_api_key: Optional[str] = None
    yandex_folder_id: Optional[str] = None
    yandex_tts_voice: str = "alena"
    yandex_tts_format: str = "oggopus"
    yandex_tts_speed: str = "1.0"

    # RAG
    chroma_persist_dir: str = "data/chroma_db"
    embedding_model: str = "intfloat/multilingual-e5-base"
    knowledge_dir: str = "data/knowledge"
    college_articles_dir: str = "data/college_articles"
    rag_top_k: int = 3
    rag_min_score: float = 0.4
    rag_fallback_min_score: float = 0.5
    intent_rule_bypass_threshold: float = 0.85
    session_history_messages: int = 10
    idle_reset_seconds: int = 180

    # Navigation
    building_graph_path: str = "data/maps/building_graph.json"
    robot_node_id: str = "entrance_main"

    # DB
    database_url: str = "sqlite+aiosqlite:///data/assistant.db"

    # Personality
    assistant_name: str = "Киоск"
    college_name: str = "Хекслет колледж"

    # Audio
    audio_cache_dir: str = "data/audio_cache"
    audio_cache_max_files: int = 200
    article_audio_cache_dir: str = "data/article_audio_cache"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
os.makedirs(settings.audio_cache_dir, exist_ok=True)