# backend/app/modules/llm/gigachat_provider.py

import httpx
import uuid
import time
import json
import re
import logging
from typing import List, Dict

from app.modules.llm.base import BaseLLM, ChatMessage, LLMResponse
from app.modules.llm.prompts import INTENT_CLASSIFICATION_PROMPT
from app.config import settings

logger = logging.getLogger(__name__)


class GigaChatLLM(BaseLLM):
    AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    API_URL = "https://gigachat.devices.sberbank.ru/api/v1"

    def __init__(self):
        self.credentials = settings.gigachat_credentials
        self.scope = settings.gigachat_scope
        self._token: str | None = None
        self._token_expires: float = 0

    async def _ensure_token(self):
        if self._token and time.time() < self._token_expires - 60:
            return

        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.post(
                self.AUTH_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "RqUID": str(uuid.uuid4()),
                    "Authorization": f"Basic {self.credentials}",
                },
                data={"scope": self.scope},
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()

        self._token = data["access_token"]
        self._token_expires = data["expires_at"] / 1000
        logger.info("GigaChat: токен обновлён")

    async def generate(
        self,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> LLMResponse:
        await self._ensure_token()

        payload = {
            "model": settings.gigachat_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.post(
                f"{self.API_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._token}",
                },
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

        text = data["choices"][0]["message"]["content"]
        logger.debug("GigaChat → %s", text[:120])
        return LLMResponse(text=text, usage=data.get("usage"))

    async def classify_intent(self, user_text: str) -> Dict:
        messages = [
            ChatMessage(role="system", content=INTENT_CLASSIFICATION_PROMPT),
            ChatMessage(role="user", content=user_text),
        ]
        response = await self.generate(messages, temperature=0.05, max_tokens=200)
        return _parse_intent_json(response.text)
    
    async def rewrite_query_with_context(self, user_text: str, history: List[ChatMessage]) -> str:
        """Перефразирует вопрос на основе контекста диалога БЕЗ потери ключевых слов."""
        if not history:
            return user_text

        # Собираем историю в читаемый текст
        formatted_history = ""
        for msg in history[-4:]:  # берем максимум 4 реплики для контекста рерайта
            role = "Пользователь" if msg.role == "user" else "Помощник"
            formatted_history += f"{role}: {msg.content}\n"

        context_prompt = (
            "Ты — эксперт по анализу текста. Твоя задача — прочитать историю диалога и последнее сообщение пользователя.\n"
            "Если последнее сообщение содержит местоимения (там, то, он, они) или является неполным (например: 'А какие?', 'Сколько стоит?', 'А где это?'), "
            "перепиши его так, чтобы оно стало самостоятельным и понятным запросом, сохранив суть.\n"
            "ЕСЛИ сообщение пользователя И ТАК понятное и самостоятельное (например: 'Какие специальности есть в колледже?'), "
            "верни его абсолютно НЕИЗМЕНЕННЫМ. Ничего не дописывай от себя.\n\n"
            f"История диалога:\n{formatted_history}\n"
            f"Последнее сообщение пользователя: {user_text}\n\n"
            "Результат (только текст запроса):"
        )

        messages = [
            ChatMessage(role="system", content="Ты — рерайтер поисковых запросов. Выдавай только финальный текст запроса, без лишних слов и вводных фраз."),
            ChatMessage(role="user", content=context_prompt)
        ]

        try:
            response = await self.generate(messages, temperature=0.0, max_tokens=70)
            rewritten = response.text.strip().strip('"').strip("'")
            logger.info("Рерайт запроса: '%s' -> '%s'", user_text, rewritten)
            return rewritten
        except Exception as e:
            logger.error("Ошибка при рерайте запроса: %s", e)
            return user_text




class _IntentFallback:
    """Rule-based классификатор: высокий confidence только для однозначных фраз."""

    GREETING = ["привет", "здравствуй", "добрый день", "добрый вечер", "доброе утро", "хай", "хелло", "салют"]
    FAREWELL = ["пока", "до свидания", "прощай", "увидимся", "всего доброго", "до встречи"]
    CAPABILITIES = ["что ты умеешь", "чем помочь", "что можешь", "твои возможности", "что умеешь"]
    SMALLTALK = ["как дела", "как тебя зовут", "кто ты", "анекдот", "шутк", "расскажи смешн"]

    INFO_ADMISSION = [
        "поступ", "приёмн", "документ", "зачисл", "подать", "абитуриент", "егэ", "балл",
        "стоимость обуч", "плата за", "срок подач", "как поступ",
    ]
    INFO_SPECIALTIES = [
        "специальност", "направлен", "профессия", "учиться на", "обучен", "профиль",
        "какие професс", "чему учат",
    ]
    INFO_COLLEGE = [
        "о колледже", "расскажи о колледж", "история колледж", "лиценз", "аккредитац",
        "диплом", "режим работ", "контакт", "телефон", "email", "сайт колледж",
        "директор", "hexlet", "хекслет", "когда работает", "часы работ",
    ]
    INFO_MARKERS = [
        "какие", "сколько", "расскаж", "что такое", "когда", "нужн", "стоимость",
        "срок", "можно ли", "есть ли",
    ]
    NAV_STRONG = [
        "как пройти", "как найти", "покажи путь", "маршрут", "куда идти", "веди в",
        "проводи в", "покажи дорогу", "как дойти", "как попасть",
    ]
    NAV_PLACE = [
        "кабинет", "аудитор", "библиотек", "туалет", "спортзал", "актуальный зал",
        "актовый", "столовая", "раздевалк", "гардероб",
    ]

    @classmethod
    def classify(cls, text: str) -> Dict:
        text_lower = text.lower().strip()

        for kw in cls.GREETING:
            if kw in text_lower:
                return {"intent": "greeting", "entities": {}, "confidence": 0.95}
        for kw in cls.FAREWELL:
            if kw in text_lower:
                return {"intent": "farewell", "entities": {}, "confidence": 0.95}
        for kw in cls.CAPABILITIES:
            if kw in text_lower:
                return {"intent": "capabilities", "entities": {}, "confidence": 0.95}

        has_info_marker = any(m in text_lower for m in cls.INFO_MARKERS)

        for kw in cls.INFO_ADMISSION:
            if kw in text_lower:
                return {"intent": "info_admission", "entities": {}, "confidence": 0.92}
        for kw in cls.INFO_SPECIALTIES:
            if kw in text_lower:
                return {"intent": "info_specialties", "entities": {}, "confidence": 0.92}
        for kw in cls.INFO_COLLEGE:
            if kw in text_lower:
                return {"intent": "info_college", "entities": {}, "confidence": 0.92}

        if has_info_marker and not any(k in text_lower for k in cls.NAV_STRONG):
            return {"intent": "unknown", "entities": {}, "confidence": 0.0}

        for kw in cls.NAV_STRONG:
            if kw in text_lower:
                return {"intent": "navigation", "entities": {}, "confidence": 0.92}

        if re.search(r"\b\d{2,4}\b", text_lower) and any(
            w in text_lower for w in ("кабинет", "каб", "аудитор", "комнат", "где ")
        ):
            room = re.search(r"\b(\d{2,4})\b", text_lower)
            entities = {"room": room.group(1)} if room else {}
            return {"intent": "navigation", "entities": entities, "confidence": 0.9}

        if text_lower.startswith("где ") and not has_info_marker:
            if any(p in text_lower for p in cls.NAV_PLACE):
                return {"intent": "navigation", "entities": {}, "confidence": 0.88}

        for kw in cls.SMALLTALK:
            if kw in text_lower:
                return {"intent": "smalltalk", "entities": {}, "confidence": 0.9}

        return {"intent": "unknown", "entities": {}, "confidence": 0.0}


def _parse_intent_json(text: str) -> Dict:
    """Извлечь JSON из ответа LLM."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"intent": "unknown", "entities": {}, "confidence": 0.0}