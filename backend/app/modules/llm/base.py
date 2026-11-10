# backend/app/modules/llm/base.py

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # system | user | assistant
    content: str


class LLMResponse(BaseModel):
    text: str
    usage: Optional[Dict] = None


class BaseLLM(ABC):
    @abstractmethod
    async def generate(
        self,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> LLMResponse:
        ...