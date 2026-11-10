# backend/app/api/routes/chat.py

from pathlib import Path
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ChatRequest(BaseModel):
    text: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    text: str
    intent: str
    ui_actions: list = []
    suggestions: list = []
    audio_url: Optional[str] = None
    tts_unavailable: bool = False


@router.post("/message", response_model=ChatResponse)
async def send_message(body: ChatRequest, request: Request):
    orchestrator = request.app.state.orchestrator
    tts = request.app.state.tts

    response = await orchestrator.process(body.text, body.session_id)

    audio_url = None
    tts_unavailable = False
    try:
        audio_path = await tts.synthesize(response.text)
        if audio_path:
            audio_url = f"/audio/{Path(audio_path).name}"
    except Exception as e:
        tts_unavailable = True
        import logging
        logging.getLogger(__name__).warning("TTS error: %s", e)

    return ChatResponse(
        text=response.text,
        intent=response.intent,
        ui_actions=response.ui_actions,
        suggestions=response.suggestions,
        audio_url=audio_url,
        tts_unavailable=tts_unavailable,
    )