# backend/app/api/routes/ws.py

import json
import base64
import logging
import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket) -> str:
        await ws.accept()
        sid = uuid.uuid4().hex[:8]
        self.active[sid] = ws
        logger.info("WS connected: %s (total: %d)", sid, len(self.active))
        return sid

    def disconnect(self, sid: str):
        self.active.pop(sid, None)
        logger.info("WS disconnected: %s", sid)


manager = ConnectionManager()


@router.websocket("/chat")
async def websocket_chat(ws: WebSocket):
    sid = await manager.connect(ws)
    orchestrator = ws.app.state.orchestrator
    stt = ws.app.state.stt
    tts = ws.app.state.tts

    await _send(ws, "state_change", {"state": "idle"})

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "text_input":
                text = msg["payload"]["text"]
                await _handle_text(ws, orchestrator, tts, text, sid)
            elif msg_type == "audio_chunk":
                payload = msg["payload"]
                audio_b64 = payload["audio"]
                audio_bytes = base64.b64decode(audio_b64)

                logger.info("[%s] Audio: %d bytes", sid, len(audio_bytes))

                # Сначала показываем "думаю" (запись уже завершена на клиенте)
                await _send(ws, "state_change", {"state": "thinking"})

                loop = asyncio.get_event_loop()
                text = await loop.run_in_executor(None, stt.transcribe, audio_bytes)

                if text:
                    await _send(ws, "stt_result", {"text": text})
                    await _handle_text(ws, orchestrator, tts, text, sid)
                else:
                    logger.warning("[%s] STT empty", sid)
                    await _send(ws, "assistant_response", {
                        "text": "Не расслышал. Попробуйте ещё раз или введите текст 😊",
                        "intent": "stt_error", "ui_actions": [], "audio_url": None,
                        "suggestions": ["Как пройти в библиотеку?", "Расскажи о колледже"],
                        "timestamp": "",
                    })
                    await _send(ws, "state_change", {"state": "idle"})
            # elif msg_type == "audio_chunk":
            #     payload = msg["payload"]
            #     audio_b64 = payload["audio"]
            #     audio_bytes = base64.b64decode(audio_b64)
            #
            #     logger.info(
            #         "[%s] Audio received: %d bytes (base64: %d chars)",
            #         sid, len(audio_bytes), len(audio_b64),
            #     )
            #
            #     await _send(ws, "state_change", {"state": "listening"})
            #
            #     # STT в отдельном потоке (блокирующий)
            #     loop = asyncio.get_event_loop()
            #     text = await loop.run_in_executor(None, stt.transcribe, audio_bytes)
            #
            #     if text:
            #         await _send(ws, "stt_result", {"text": text})
            #         await _handle_text(ws, orchestrator, tts, text, sid)
            #     else:
            #         logger.warning("[%s] STT returned empty text", sid)
            #         await _send(ws, "assistant_response", {
            #             "text": "Не удалось распознать речь. Попробуйте ещё раз или введите текст.",
            #             "intent": "stt_error",
            #             "ui_actions": [],
            #             "suggestions": [
            #                 "Как пройти в столовую?",
            #                 "Расскажи о колледже",
            #             ],
            #             "audio_url": None,
            #             "timestamp": "",
            #         })
            #         await _send(ws, "state_change", {"state": "idle"})

            elif msg_type == "map_tap":
                logger.info(msg)
                room_id = msg["payload"].get("room_id", "")
                text = f"Как пройти в {room_id}?"
                await _handle_text(ws, orchestrator, tts, text, sid)

            elif msg_type == "ping":
                await _send(ws, "pong", {})

    except WebSocketDisconnect:
        manager.disconnect(sid)
    except Exception as e:
        logger.exception("WS error for %s", sid)
        manager.disconnect(sid)


def _extract_audio_url(audio_path: str) -> str | None:
    if not audio_path:
        return None
    filename = Path(audio_path).name
    return f"/audio/{filename}"


async def _handle_text(ws: WebSocket, orchestrator, tts, text: str, session_id: str):
    await _send(ws, "state_change", {"state": "thinking"})

    response = await orchestrator.process(text, session_id)

    audio_url = None
    tts_unavailable = False
    try:
        audio_path = await tts.synthesize(response.text)
        audio_url = _extract_audio_url(audio_path)
    except Exception as e:
        tts_unavailable = True
        logger.warning("TTS error: %s", e)
        await _send(ws, "notification", {
            "kind": "warning",
            "text": "Система озвучания временно находится на профилактике. Текстовый ответ доступен.",
            "duration_ms": 4000,
        })

    await _send(ws, "state_change", {"state": "speaking"})

    payload = response.to_dict()
    payload["audio_url"] = audio_url
    payload["tts_unavailable"] = tts_unavailable
    await _send(ws, "assistant_response", payload)

    word_count = len(response.text.split())
    delay = max(2, word_count * 0.3)
    await asyncio.sleep(delay)
    await _send(ws, "state_change", {"state": "idle"})


async def _send(ws: WebSocket, msg_type: str, payload: dict):
    await ws.send_json({"type": msg_type, "payload": payload})