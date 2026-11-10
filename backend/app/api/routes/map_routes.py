# backend/app/api/routes/map_routes.py

import json
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import settings

router = APIRouter()


class RouteRequest(BaseModel):
    destination: str
    start: Optional[str] = None


@router.get("/rooms")
async def get_rooms(request: Request):
    nav = request.app.state.nav
    return {"rooms": nav.get_all_rooms()}


@router.get("/graph")
async def get_graph(request: Request):
    nav = request.app.state.nav
    return {
        "nodes": nav.get_nodes_json(),
        "edges": nav.get_edges_json(),
    }


@router.get("/floors_outline")
async def get_floors_outline():
    """Контуры этажей здания для отрисовки."""
    path = Path(settings.building_graph_path)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("floors_outline", {})


@router.post("/route")
async def find_route(body: RouteRequest, request: Request):
    nav = request.app.state.nav
    dest = nav.resolve_destination(body.destination)
    if not dest:
        raise HTTPException(404, f"Место не найдено: {body.destination}")
    route = nav.find_path(dest, body.start)
    if not route:
        raise HTTPException(404, "Маршрут не найден")
    return {"route": route}