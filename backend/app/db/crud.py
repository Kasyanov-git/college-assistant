# backend/app/db/crud.py

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Interaction
# from db.models import Interaction

logger = logging.getLogger(__name__)


async def log_interaction(
    session: AsyncSession,
    session_id: str,
    user_text: str,
    intent: str,
    entities: dict,
    response_text: str,
):
    interaction = Interaction(
        session_id=session_id,
        user_text=user_text,
        intent=intent,
        entities=entities,
        response_text=response_text,
    )
    session.add(interaction)
    await session.commit()