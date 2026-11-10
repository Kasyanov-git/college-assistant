import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
logger = logging.getLogger(__name__)


def _condition(weather_code: str) -> str:
    code = int(weather_code)
    if code == 113:
        return "clear"
    if code == 116:
        return "partly-cloudy"
    if code in {119, 122}:
        return "overcast"
    if code in {143, 248, 260}:
        return "fog"
    if code in {179, 182, 227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377}:
        return "snow"
    if code in {200, 386, 389, 392, 395}:
        return "thunderstorm"
    if code in {176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359, 362, 365}:
        return "rain"
    return "cloudy"


@router.get("/current")
async def current_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    url = f"https://wttr.in/{lat},{lon}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params={"format": "j1", "lang": "ru"},
                headers={"User-Agent": "CollegeAssistant/1.0"},
                timeout=10.0,
            )
            response.raise_for_status()
            current = (response.json().get("current_condition") or [{}])[0]
            return {
                "temp": float(current["temp_C"]),
                "condition": _condition(current["weatherCode"]),
            }
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Weather provider request failed: %s", exc)
        raise HTTPException(status_code=502, detail="weather provider unavailable") from exc
