# backend/app/core/orchestrator.py

import json
import re
import logging
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from app.modules.llm.base import BaseLLM, ChatMessage
from app.modules.llm.prompts import (
    SYSTEM_PROMPT,
    RAG_SYSTEM_PROMPT,
    DESTINATION_EXTRACTION_PROMPT,
    NAVIGATION_RESPONSE_PROMPT,
    RAG_RESPONSE_PROMPT,
    SMALLTALK_PROMPT,
)
from app.modules.rag.knowledge_base import KnowledgeBase
from app.modules.navigation.graph import BuildingGraph
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AssistantResponse:
    text: str
    intent: str = "unknown"
    ui_actions: list = field(default_factory=list)
    suggestions: list = field(default_factory=list)
    entities: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "intent": self.intent,
            "ui_actions": self.ui_actions,
            "suggestions": self.suggestions,
            "entities": self.entities,
            "timestamp": datetime.utcnow().isoformat(),
        }


DEFAULT_SUGGESTIONS = [
    "Как пройти в библиотеку?",
    "Расскажи о колледже",
    "Какие специальности есть?",
    "Где приёмная комиссия?",
]


class Orchestrator:
    def __init__(self, llm: BaseLLM, knowledge_base: KnowledgeBase, building_graph: BuildingGraph):
        self.llm = llm
        self.kb = knowledge_base
        self.nav = building_graph
        self.sessions: Dict[str, List[ChatMessage]] = {}

        # Кэшируем список мест для LLM (не меняется в рантайме)
        self._locations_prompt_cache = self.nav.get_locations_for_llm()
        logger.info("Locations list for LLM:\n%s", self._locations_prompt_cache[:500])

    def _history(self, session_id: str) -> List[ChatMessage]:
        return self.sessions.get(session_id, [])[-settings.session_history_messages:]

    # async def process(self, user_text: str, session_id: str = "default") -> AssistantResponse:
    #     user_text = user_text.strip()
    #     if not user_text:
    #         return AssistantResponse(text="Я вас не расслышал. Повторите, пожалуйста?", suggestions=DEFAULT_SUGGESTIONS)

    #     logger.info("[%s] Пользователь: %s", session_id, user_text)

    #     # 1. Классификация
    #     intent_data = await self._classify(user_text)
    #     intent = intent_data.get("intent", "unknown")
    #     entities = {k: v for k, v in intent_data.get("entities", {}).items() if v}

    #     logger.info("[%s] Intent=%s entities=%s", session_id, intent, entities)

    #     # 2. Обработка
    #     response = await self._handle(intent, entities, user_text, session_id)

    #     # 3. История
    #     self._save_history(session_id, user_text, response.text)

    #     return response

    # async def _classify(self, text: str) -> Dict:
    #     from app.modules.llm.gigachat_provider import _IntentFallback
    #     quick = _IntentFallback.classify(text)
    #     if quick["confidence"] >= settings.intent_rule_bypass_threshold:
    #         return quick

    #     try:
    #         llm_result = await self.llm.classify_intent(text)
    #         if llm_result.get("intent") == "unknown" and quick["confidence"] >= 0.88:
    #             return quick
    #         return llm_result
    #     except Exception as e:
    #         logger.warning("LLM classify error: %s, fallback to rules", e)
    #         return quick

    async def process(self, user_text: str, session_id: str = "default") -> AssistantResponse:
        user_text = user_text.strip()
        if not user_text:
            return AssistantResponse(text="Я вас не расслышал. Повторите, пожалуйста?", suggestions=DEFAULT_SUGGESTIONS)

        logger.info("[%s] Пользователь: %s", session_id, user_text)

        # Достаем историю для текущей сессии (последние 6 сообщений = 3 диалога)
        history = self._history(session_id)

        # 1. Классификация (теперь с учетом контекста, если это необходимо)
        intent_data = await self._classify(user_text, history)
        intent = intent_data.get("intent", "unknown")
        entities = {k: v for k, v in intent_data.get("entities", {}).items() if v}

        logger.info("[%s] Intent=%s entities=%s", session_id, intent, entities)

        # 2. Обработка
        response = await self._handle(intent, entities, user_text, session_id)

        # 3. История
        self._save_history(session_id, user_text, response.text)

        return response

    async def _classify(self, text: str, history: List[ChatMessage]) -> Dict:
        from app.modules.llm.gigachat_provider import _IntentFallback
        
        # Если это короткое/зависимое слово (например, "да", "балл", "а там?"), 
        # правила отработают плохо. Сначала вызовем рерайт, если есть история.
        search_text = text
        if history and len(text.split()) < 4:
            if hasattr(self.llm, 'rewrite_query_with_context'):
                search_text = await self.llm.rewrite_query_with_context(text, history)

        quick = _IntentFallback.classify(search_text)
        if quick["confidence"] >= settings.intent_rule_bypass_threshold:
            return quick

        try:
            # Для LLM-классификатора отправляем оригинальный текст
            # (Но если у вас LLM часто ошибается на коротких контекстных фразах, можно передать search_text)
            llm_result = await self.llm.classify_intent(search_text)
            if llm_result.get("intent") == "unknown" and quick["confidence"] >= 0.88:
                return quick
            return llm_result
        except Exception as e:
            logger.warning("LLM classify error: %s, fallback to rules", e)
            return quick


    async def _handle(
        self, intent: str, entities: dict, user_text: str, session_id: str
    ) -> AssistantResponse:
        try:
            match intent:
                case "greeting":
                    return self._greeting()
                case "farewell":
                    return self._farewell()
                case "capabilities":
                    return self._capabilities()
                case "navigation":
                    return await self._navigation(entities, user_text, session_id)
                case "info_college" | "info_specialties" | "info_admission":
                    return await self._info_rag(user_text, session_id)
                case "info_news":
                    return self._news_stub()
                case "smalltalk":
                    return await self._smalltalk(user_text, session_id)
                case "schedule":
                    return self._not_supported("Расписание")
                case _:
                    return await self._try_rag_or_unknown(user_text, session_id)
        except Exception:
            logger.exception("Handler error for intent=%s", intent)
            return AssistantResponse(
                text="Произошла ошибка при обработке. Попробуйте ещё раз.",
                intent="error",
                suggestions=DEFAULT_SUGGESTIONS,
            )

    # ─── Handlers ──────────────────────────────────────

    def _greeting(self) -> AssistantResponse:
        hour = datetime.now().hour
        greet = "Доброе утро" if hour < 12 else "Добрый день" if hour < 17 else "Добрый вечер"
        return AssistantResponse(
            text=f"{greet}! Я {settings.assistant_name}, помощник {settings.college_name}. "
                 f"Могу подсказать, как пройти в нужный кабинет, рассказать о колледже и специальностях. "
                 f"Чем помочь? 😊",
            intent="greeting",
            ui_actions=[{"action": "show_welcome"}],
            suggestions=DEFAULT_SUGGESTIONS,
        )

    def _farewell(self) -> AssistantResponse:
        return AssistantResponse(
            text="До свидания! Удачного дня! Если что — я всегда здесь 👋",
            intent="farewell",
            ui_actions=[{"action": "reset_to_idle"}],
        )

    def _capabilities(self) -> AssistantResponse:
        return AssistantResponse(
            text=f"Я {settings.assistant_name}, и вот что я умею:\n\n"
                 "🗺 **Навигация** — покажу путь до любого кабинета на интерактивной карте\n"
                 "📋 **Информация** — расскажу о колледже, специальностях, поступлении\n"
                 "💬 **Общение** — могу просто поболтать\n\n"
                 "Спрашивайте!",
            intent="capabilities",
            suggestions=DEFAULT_SUGGESTIONS,
        )

    @staticmethod
    def _looks_like_info_not_nav(text: str) -> bool:
        """Справочный вопрос, ошибочно помеченный как навигация."""
        t = text.lower()
        info_markers = (
            "какие", "сколько", "расскаж", "что такое", "когда", "нужн",
            "документ", "поступ", "специальност", "лиценз", "диплом", "контакт",
            "телефон", "режим работ", "стоимость", "срок", "email", "сайт",
            "аккредитац", "история", "обучен",
        )
        nav_strong = (
            "как пройти", "как найти", "покажи путь", "маршрут", "куда идти",
            "проводи", "покажи дорогу", "как дойти", "как попасть",
        )
        if any(m in t for m in nav_strong):
            return False
        return any(m in t for m in info_markers)

    async def _navigation(self, entities: dict, user_text: str, session_id: str) -> AssistantResponse:
        """
        Навигация: 3 уровня поиска
          1. LLM извлекает destination_id из списка мест
          2. Алгоритмический resolve по entities (room/person/department)
          3. Алгоритмический resolve по всему user_text
        """
        if self._looks_like_info_not_nav(user_text):
            logger.info("Запрос перенаправлен из navigation в RAG: %s", user_text[:60])
            return await self._info_rag(user_text, session_id)

        destination_id = None

        # ═══ УРОВЕНЬ 1: LLM-извлечение ═══
        try:
            destination_id = await self._llm_resolve_destination(user_text)
            if destination_id:
                logger.info("LLM нашла место: %s", destination_id)
        except Exception as e:
            logger.warning("LLM destination extraction failed: %s", e)

        # ═══ УРОВЕНЬ 2: Алгоритмический по entities ═══
        if not destination_id:
            query = entities.get("room") or entities.get("person") or entities.get("department")
            if query:
                destination_id = self.nav.resolve_destination(query)
                if destination_id:
                    logger.info("Algorithmic (entities) нашёл: %s", destination_id)

        # ═══ УРОВЕНЬ 3: Алгоритмический по всему тексту ═══
        if not destination_id:
            destination_id = self.nav.resolve_destination(user_text)
            if destination_id:
                logger.info("Algorithmic (full text) нашёл: %s", destination_id)

        # Ничего не нашли
        if not destination_id:
            return AssistantResponse(
                text="К сожалению, я не нашёл это место на карте. "
                     "Попробуйте назвать номер кабинета или описать место по-другому.",
                intent="navigation",
                suggestions=["Где библиотека?", "Где приёмная комиссия?", "Где кабинет 305?"],
            )

        # Строим маршрут
        route = self.nav.find_path(destination_id)
        if not route:
            return AssistantResponse(
                text="Не удалось построить маршрут. Попробуйте другой запрос.",
                intent="navigation",
                suggestions=DEFAULT_SUGGESTIONS,
            )

        # Генерируем текстовый ответ через LLM
        prompt = NAVIGATION_RESPONSE_PROMPT.format(
            destination=route["destination_label"],
            floor=route["target_floor"],
            route_description=route["description"],
            estimated_time=route["estimated_time"],
        )
        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=prompt),
        ]

        try:
            llm_resp = await self.llm.generate(messages, temperature=0.5, max_tokens=200)
            text = llm_resp.text
        except Exception:
            text = route["description"]

        return AssistantResponse(
            text=text,
            intent="navigation",
            entities={"destination": destination_id, "floor": route["target_floor"]},
            ui_actions=[{
                "action": "show_route",
                "data": {
                    # visual_path содержит промежуточные точки между узлами,
                    # включая edge waypoints для корректной линии маршрута.
                    "path": route["visual_path"],
                    # path_nodes оставляем для подсветки комнат/узлов на фронте.
                    "path_nodes": route["path_details"],
                    "target_floor": route["target_floor"],
                    "estimated_time": route["estimated_time"],
                    "destination_label": route["destination_label"],
                    "floors": route["floors"],
                },
            }],
            suggestions=["Спасибо!", "Где библиотека?", "Где туалет?"],
        )

    async def _llm_resolve_destination(self, user_text: str) -> Optional[str]:
        """
        Попросить LLM определить место назначения из текста пользователя,
        сверяя со списком известных мест.
        """
        prompt = DESTINATION_EXTRACTION_PROMPT.format(
            locations_list=self._locations_prompt_cache,
            user_text=user_text,
        )

        messages = [
            ChatMessage(role="user", content=prompt),
        ]

        response = await self.llm.generate(messages, temperature=0.05, max_tokens=150)

        # Парсим JSON ответ
        result = self._parse_json(response.text)
        if not result:
            return None

        location_id = result.get("location_id")
        confidence = result.get("confidence", 0.0)
        reasoning = result.get("reasoning", "")

        logger.info(
            "LLM destination extraction: id=%s, confidence=%.2f, reason='%s'",
            location_id, confidence, reasoning,
        )

        # Проверяем что ID реально существует в графе
        if location_id and confidence >= 0.5:
            verified = self.nav.resolve_by_id(location_id)
            if verified:
                return verified
            else:
                logger.warning("LLM вернула несуществующий ID: %s", location_id)

        return None

    @staticmethod
    def _parse_json(text: str) -> Optional[dict]:
        """Извлечь JSON из текста LLM."""
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
        return None

    # async def _info_rag(self, user_text: str) -> AssistantResponse:
    #     results = self.kb.search(user_text)

    #     if not results:
    #         return AssistantResponse(
    #             text="По этому вопросу в моей базе нет точного ответа. "
    #                  "Уточните в приёмной комиссии: 2 этаж, кабинет 240, телефон +7(800) 222-75-46.",
    #             intent="info",
    #             suggestions=["Где приёмная комиссия?", "Какие специальности?", "Что ты умеешь?"],
    #         )

    #     context = "\n\n---\n\n".join(f"[{r['section']}]\n{r['text']}" for r in results)
    #     prompt = RAG_RESPONSE_PROMPT.format(context=context, question=user_text)
    #     messages = [
    #         ChatMessage(role="system", content=RAG_SYSTEM_PROMPT),
    #         ChatMessage(role="user", content=prompt),
    #     ]

    #     try:
    #         llm_resp = await self.llm.generate(messages, temperature=0.3, max_tokens=450)
    #         text = llm_resp.text
    #     except Exception:
    #         text = results[0]["text"][:400]

    #     return AssistantResponse(
    #         text=text,
    #         intent="info",
    #         suggestions=["Расскажи подробнее", "Какие специальности?", "Как поступить?"],
    #     )

    async def _info_rag(self, user_text: str, session_id: str = "default") -> AssistantResponse:
        history = self._history(session_id)
        
        # 1. Контекстуализация запроса
        search_query = user_text
        if history and hasattr(self.llm, 'rewrite_query_with_context'):
            search_query = await self.llm.rewrite_query_with_context(user_text, history)
        
        # 2. Поиск по базе знаний по ОЧИЩЕННОМУ запросу
        results = self.kb.search(search_query)

        context = "\n\n---\n\n".join(f"[{r['section']}]\n{r['text']}" for r in results)
        logger.info("ЧТО ВЗЯТО ИЗ БАЗЫ: \n%s", context)

        # Если ChromaDB ничего не нашла по измененному запросу, пробуем сделать поиск по оригиналу
        if not results and search_query != user_text:
            logger.info("RAG пуст по search_query, пробуем оригинальный user_text")
            results = self.kb.search(user_text)

        if not results:
            return AssistantResponse(
                text="По этому вопросу в моей базе нет точного ответа. "
                     "Уточните в приёмной комиссии: 2 этаж, кабинет 240, телефон +7(800) 222-75-46.",
                intent="info",
                suggestions=["Где приёмная комиссия?", "Какие специальности?", "Что ты умеешь?"],
            )

        # 3. Сборка контекста документов
        context = "\n\n---\n\n".join(f"[{r['section']}]\n{r['text']}" for r in results)
        
        # ВАЖНО: В prompt передаем search_query, чтобы модель отвечала на конкретный развернутый вопрос!
        prompt = RAG_RESPONSE_PROMPT.format(context=context, question=search_query)
        
        # 4. Формируем сообщения для генерации. 
        # Чтобы избежать галлюцинаций из истории, мы НЕ подмешиваем всю историю прямо в RAG_SYSTEM_PROMPT.
        # Вместо этого мы даем четкую инструкцию отвечать СТРОГО по контексту.
        messages = [
            ChatMessage(role="system", content=RAG_SYSTEM_PROMPT),
            ChatMessage(role="user", content=prompt)
        ]

        try:
            # Используем низкую температуру (0.1 или 0.2), чтобы минимизировать фантазии модели
            llm_resp = await self.llm.generate(messages, temperature=0.1, max_tokens=500)
            text = llm_resp.text
        except Exception as e:
            logger.error("RAG LLM generation failed: %s", e)
            text = results[0]["text"][:400]

        return AssistantResponse(
            text=text,
            intent="info",
            suggestions=["Расскажи подробнее", "Какие специальности?", "Как поступить?"],
        )


    def _news_stub(self) -> AssistantResponse:
        return AssistantResponse(
            text="Раздел новостей пока в разработке. Актуальные новости можно посмотреть "
                 "на сайте колледжа или в группе ВКонтакте.",
            intent="news",
            suggestions=DEFAULT_SUGGESTIONS,
        )

    async def _smalltalk(self, user_text: str, session_id: str) -> AssistantResponse:
        history = self._history(session_id)
        messages = [ChatMessage(role="system", content=SMALLTALK_PROMPT)]
        messages.extend(history)
        messages.append(ChatMessage(role="user", content=user_text))

        try:
            llm_resp = await self.llm.generate(messages, temperature=0.8, max_tokens=150)
            text = llm_resp.text
        except Exception:
            text = "Я пока не очень силён в болтовне, но работаю над собой 😄 Может, помочь с навигацией?"

        return AssistantResponse(text=text, intent="smalltalk", suggestions=["Расскажи о колледже", "Где приёмная комиссия?"])

    def _not_supported(self, feature: str) -> AssistantResponse:
        return AssistantResponse(
            text=f"{feature} — функция в разработке. Скоро будет! "
                 f"А пока могу помочь с навигацией или рассказать о колледже.",
            intent="not_supported",
            suggestions=DEFAULT_SUGGESTIONS,
        )

    # async def _try_rag_or_unknown(self, user_text: str, session_id: str) -> AssistantResponse:
    #     """Для unknown: сначала RAG, затем уточняющий ответ."""
    #     results = self.kb.search(user_text, top_k=settings.rag_top_k)
    #     if results and results[0]["score"] >= settings.rag_fallback_min_score:
    #         logger.info(
    #             "unknown → RAG (score=%.3f): %s",
    #             results[0]["score"],
    #             user_text[:50],
    #         )
    #         return await self._info_rag(user_text)

    #     return AssistantResponse(
    #         text="Не совсем понял вопрос. Попробуйте переформулировать "
    #              "или выберите подсказку ниже 👇",
    #         intent="unknown",
    #         suggestions=DEFAULT_SUGGESTIONS,
    #     )
    async def _try_rag_or_unknown(self, user_text: str, session_id: str) -> AssistantResponse:
        """Для unknown: сначала RAG с учетом контекста, затем уточняющий ответ."""
        history = self._history(session_id)
        search_query = user_text
        if history and hasattr(self.llm, 'rewrite_query_with_context'):
            search_query = await self.llm.rewrite_query_with_context(user_text, history)

        results = self.kb.search(search_query, top_k=settings.rag_top_k)
        if results and results[0]["score"] >= settings.rag_fallback_min_score:
            logger.info(
                "unknown → RAG (score=%.3f): %s",
                results[0]["score"],
                user_text[:50],
            )
            return await self._info_rag(user_text, session_id)

        return AssistantResponse(
            text="Не совсем понял вопрос. Попробуйте переформулировать "
                 "или выберите подсказку ниже 👇",
            intent="unknown",
            suggestions=DEFAULT_SUGGESTIONS,
        )


    # ─── Session ───────────────────────────────────────

    def _save_history(self, session_id: str, user_text: str, assistant_text: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        h = self.sessions[session_id]
        h.append(ChatMessage(role="user", content=user_text))
        h.append(ChatMessage(role="assistant", content=assistant_text))
        if len(h) > settings.session_history_messages:
            self.sessions[session_id] = h[-settings.session_history_messages:]