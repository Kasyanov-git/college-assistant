# backend/app/main.py

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")


def _spa_static_dir() -> Path | None:
    if getattr(sys, "frozen", False):
        candidates = [Path(sys._MEIPASS) / "frontend" / "dist"]
    else:
        candidates = [Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"]
    for c in candidates:
        if (c / "index.html").is_file():
            return c
    return None


def create_stt():
    if settings.stt_provider == "vosk":
        from app.modules.speech.stt_vosk import VoskSTT
        return VoskSTT()
    else:
        from app.modules.speech.stt_whisper import WhisperSTT
        return WhisperSTT()


def create_tts():
    from app.modules.speech.fallback import FallbackTTS, SilentTTS

    def build(provider):
        if provider == "gemini":
            from app.modules.speech.tts_gemini import GeminiTTS
            return GeminiTTS()
        from app.modules.speech.tts_yandex import YandexSpeechTTS
        return YandexSpeechTTS()

    providers = []
    for provider in (settings.tts_provider, settings.tts_fallback_provider):
        if any(existing[0] == provider for existing in providers):
            continue
        try:
            providers.append((provider, build(provider)))
        except Exception:
            logger.exception("Не удалось инициализировать TTS-провайдер %s", provider)

    if not providers:
        logger.warning("TTS отключён: текстовые ответы остаются доступными")
        return SilentTTS()

    instances = [instance for _, instance in providers]
    if not instances:
        return SilentTTS()
    return FallbackTTS(instances)


def create_llm():
    from app.modules.llm.fallback import FallbackLLM

    def build(provider):
        if provider == "gigachat":
            from app.modules.llm.gigachat_provider import GigaChatLLM
            return GigaChatLLM()
        from app.modules.llm.ollama_provider import OllamaLLM
        return OllamaLLM()

    primary = build(settings.llm_provider)
    # Пока резерв — тот же экземпляр. Замените provider в .env после
    # подключения другой модели.
    fallback = primary if settings.llm_fallback_provider == settings.llm_provider else build(settings.llm_fallback_provider)
    return FallbackLLM([primary, fallback])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Запуск %s...", settings.app_name)

    llm = create_llm()
    logger.info("✅ LLM: %s", settings.llm_provider.value)

    from app.modules.rag.knowledge_base import KnowledgeBase
    kb = KnowledgeBase()
    kb.load_documents()
    logger.info("✅ RAG: %d документов", kb.collection.count())

    from app.modules.navigation.graph import BuildingGraph
    nav = BuildingGraph()
    logger.info("✅ Навигация: %d узлов", nav.graph.number_of_nodes())

    stt = create_stt()
    logger.info("✅ STT: %s", settings.stt_provider.value)

    tts = create_tts()
    logger.info("✅ TTS: %s -> fallback %s", settings.tts_provider.value, settings.tts_fallback_provider.value)

    from app.db.database import init_db
    await init_db()
    logger.info("✅ БД инициализирована")

    from app.core.orchestrator import Orchestrator
    orchestrator = Orchestrator(llm=llm, knowledge_base=kb, building_graph=nav)

    app.state.orchestrator = orchestrator
    app.state.stt = stt
    app.state.tts = tts
    app.state.nav = nav
    app.state.kb = kb

    logger.info("🟢 Все модули готовы!")
    yield
    logger.info("👋 Завершение")


app = FastAPI(title="College Assistant API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.audio_cache_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=settings.audio_cache_dir), name="audio")
os.makedirs(settings.article_audio_cache_dir, exist_ok=True)
app.mount("/audio_articles", StaticFiles(directory=settings.article_audio_cache_dir), name="audio_articles")

from app.api.routes import chat, ws, map_routes, embed, articles, weather  # noqa: E402

app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(ws.router, prefix="/api/ws", tags=["WebSocket"])
app.include_router(map_routes.router, prefix="/api/map", tags=["Map"])
app.include_router(embed.router, prefix="/api/embed", tags=["Embed"])
app.include_router(articles.router, prefix="/api/articles", tags=["Articles"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "name": settings.assistant_name,
        "tts": settings.tts_provider.value,
        "llm": settings.llm_provider.value,
    }


_spa_dir = _spa_static_dir()
if _spa_dir is not None:
    app.mount(
        "/",
        StaticFiles(directory=str(_spa_dir), html=True),
        name="spa",
    )
    logger.info("Веб-интерфейс: %s", _spa_dir)
else:
    logger.info("Сборка frontend/dist не найдена — только API (режим разработки).")