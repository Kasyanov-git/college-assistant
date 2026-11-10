# backend/app/api/routes/embed.py

import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()


def _frame_blocked(xfo: str, csp: str) -> tuple[bool, str]:
    xfo_u = (xfo or "").strip().upper()
    if xfo_u in ("DENY", "SAMEORIGIN"):
        return True, f"X-Frame-Options: {xfo_u}"

    csp_l = (csp or "").lower()
    if "frame-ancestors" in csp_l:
        if "'none'" in csp_l or "none" in csp_l.split("frame-ancestors")[-1][:40]:
            return True, "CSP frame-ancestors запрещает встраивание"
        # frame-ancestors 'self' — то же, что SAMEORIGIN для чужого origin
        if "'self'" in csp_l and "frame-ancestors" in csp_l:
            return True, "CSP frame-ancestors: 'self'"

    return False, ""


@router.get("/can-frame")
async def can_frame(url: str = Query(..., min_length=8)):
    """Проверка, можно ли открыть URL во iframe с домена киоска."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "URL должен начинаться с http:// или https://")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=12.0,
            headers={"User-Agent": "CollegeAssistantKiosk/1.0"},
        ) as client:
            resp = await client.head(url)
            if resp.status_code >= 400:
                resp = await client.get(url)
    except httpx.HTTPError as e:
        logger.warning("embed check failed for %s: %s", url, e)
        return {
            "allowed": False,
            "reason": "Не удалось проверить сайт (сеть или таймаут)",
            "suggest_external": True,
        }

    xfo = resp.headers.get("x-frame-options", "")
    csp = resp.headers.get("content-security-policy", "")
    blocked, reason = _frame_blocked(xfo, csp)

    return {
        "allowed": not blocked,
        "reason": reason or None,
        "suggest_external": blocked,
        "status_code": resp.status_code,
    }
