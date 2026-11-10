# backend/app/modules/navigation/graph.py

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import networkx as nx

from app.config import settings

logger = logging.getLogger(__name__)

NOISE_WORDS = [
    "как пройти", "как найти", "как попасть", "где находится", "где расположен",
    "где расположена", "где расположено",
    "покажи", "покажи путь", "покажи дорогу", "проведи",
    "подскажи где", "подскажи как",
    "мне нужно", "мне надо", "хочу найти", "хочу попасть",
    "нужно найти", "нужно попасть",
    "где", "куда", "в какой", "в какую",
    "пройти в", "пройти к", "пройти до", "попасть в", "попасть к",
    "найти", "дойти до", "дойти к",
    "кабинет", "аудитория", "аудиторию", "комната", "комнату",
    "каб.", "каб", "ауд.", "ауд",
    "номер", "помещение",
]

RUSSIAN_ENDINGS = [
    "ую", "юю", "ой", "ей", "ый", "ий", "ая", "яя",
    "ого", "его", "ому", "ему",
    "ом", "ем", "ой", "ей",
    "ые", "ие", "ых", "их", "ым", "им", "ыми", "ими",
    "у", "ю", "а", "я", "е", "о", "и", "ы",
]


def _rough_stem(word: str) -> str:
    if len(word) <= 3:
        return word
    for ending in RUSSIAN_ENDINGS:
        if word.endswith(ending) and len(word) - len(ending) >= 3:
            return word[:-len(ending)]
    return word


def _normalize_query(text: str) -> str:
    q = text.lower().strip()
    q = re.sub(r'[?!.,;:»«"\'()—–\-]', ' ', q)
    noise_sorted = sorted(NOISE_WORDS, key=len, reverse=True)
    for noise in noise_sorted:
        q = q.replace(noise, " ")
    q = re.sub(r'\s+', ' ', q).strip()
    return q


def _stems_match(text1: str, text2: str) -> bool:
    stems1 = {_rough_stem(w) for w in text1.lower().split() if len(w) > 2}
    stems2 = {_rough_stem(w) for w in text2.lower().split() if len(w) > 2}
    if not stems1 or not stems2:
        return False
    return bool(stems1 & stems2)


class BuildingGraph:
    def __init__(self):
        self.graph = nx.Graph()
        self.nodes_data: Dict[str, dict] = {}
        self.edges_data: Dict[Tuple[str, str], dict] = {}
        self.aliases: Dict[str, str] = {}
        self.robot_position = settings.robot_node_id
        self._load()

    def _load(self):
        path = Path(settings.building_graph_path)
        if not path.exists():
            logger.error("Файл графа не найден: %s", path)
            return

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for node in data.get("nodes", []):
            nid = node["id"]
            self.graph.add_node(nid, **node)
            self.nodes_data[nid] = node

        for edge in data.get("edges", []):
            fr, to = edge["from"], edge["to"]
            self.graph.add_edge(
                fr, to,
                weight=edge.get("weight", 1),
                edge_type=edge.get("type", "walk"),
            )
            # Сохраняем данные ребра в обоих направлениях
            self.edges_data[(fr, to)] = edge
            self.edges_data[(to, fr)] = edge

        self.aliases = {k.lower(): v for k, v in data.get("aliases", {}).items()}
        meta = data.get("meta", {})
        self.robot_position = meta.get("robot_position", self.robot_position)

        logger.info(
            "Граф: %d узлов, %d рёбер, %d алиасов",
            self.graph.number_of_nodes(),
            self.graph.number_of_edges(),
            len(self.aliases),
        )

    # ── Координаты точки привязки ноды ───────────────────────────
    def _get_node_point(self, node_id: str) -> dict:
        """
        Возвращает координаты точки привязки ноды.
        Приоритет: door > waypoint > центр прямоугольника.
        """
        nd = self.nodes_data.get(node_id, {})

        # 1) Явная дверь
        if "door" in nd:
            return {"x": nd["door"]["x"], "y": nd["door"]["y"], "floor": nd.get("floor", 1)}

        # 2) Явный waypoint (для коридоров)
        if "waypoint" in nd:
            return {"x": nd["waypoint"]["x"], "y": nd["waypoint"]["y"], "floor": nd.get("floor", 1)}

        # 3) Центр прямоугольника (fallback)
        x = nd.get("x", 0) + nd.get("w", 0) / 2
        y = nd.get("y", 0) + nd.get("h", 0) / 2
        return {"x": x, "y": y, "floor": nd.get("floor", 1)}

    # ── Waypoints ребра ──────────────────────────────────────────
    def _get_edge_waypoints(self, from_id: str, to_id: str) -> List[dict]:
        """
        Возвращает список промежуточных waypoints ребра.
        Если ребро задано в обратном направлении — точки разворачиваются.
        """
        # Прямое направление
        edge = self.edges_data.get((from_id, to_id))
        if edge and "waypoints" in edge:
            wps = edge["waypoints"]
            # Если ребро записано в прямом направлении
            if edge["from"] == from_id:
                return wps
            else:
                return list(reversed(wps))

        return []

    # ── Построение детализированного пути ────────────────────────
    def _build_visual_path(self, node_path: List[str]) -> List[dict]:
        """
        По списку node_id строит массив точек для отрисовки линии.
        Каждая точка: { x, y, floor, node_id? }

        Логика для каждого ребра (A → B):
          1. Точка A (door/waypoint/center)
          2. edge waypoints (если есть)
          3. Точка B (door/waypoint/center)

        Дубликаты подряд убираются.
        """
        if not node_path:
            return []

        points: List[dict] = []

        for i in range(len(node_path)):
            current_id = node_path[i]
            current_node = self.nodes_data.get(current_id, {})
            current_type = current_node.get("type", "")
            current_point = self._get_node_point(current_id)
            current_point["node_id"] = current_id

            if i == 0:
                points.append(current_point)
                continue

            prev_id = node_path[i - 1]

            # Waypoints ребра
            edge_wps = self._get_edge_waypoints(prev_id, current_id)
            for wp in edge_wps:
                wp_point = {
                    "x": wp["x"],
                    "y": wp["y"],
                    "floor": current_point.get("floor", 1),
                }
                # Не дублировать, если совпадает с последней точкой
                if not points or (points[-1]["x"] != wp_point["x"] or points[-1]["y"] != wp_point["y"]):
                    points.append(wp_point)

            # Точка текущей ноды:
            # - всегда добавляем для конечной точки пути;
            # - для транзитных corridor/hall НЕ добавляем фиксированный waypoint,
            #   чтобы маршрут не "тянулся" к одной и той же точке коридора.
            is_last = i == len(node_path) - 1
            is_transit_corridor = (current_type in ("corridor", "hall")) and not is_last
            if not is_transit_corridor:
                if not points or (points[-1]["x"] != current_point["x"] or points[-1]["y"] != current_point["y"]):
                    points.append(current_point)

        logger.info("Точки на пути: %s", points)
        return points

    # ── Поиск по запросу (без изменений) ─────────────────────────

    def get_locations_for_llm(self) -> str:
        lines = []
        for nid, nd in self.nodes_data.items():
            ntype = nd.get("type", "")
            if ntype in ("corridor", "hall"):
                continue
            label = nd.get("label", nid)
            name = nd.get("name", "")
            floor = nd.get("floor", "?")
            name_part = f' | описание: "{name}"' if name else ""
            lines.append(f'  id: "{nid}" | label: "{label}"{name_part} | этаж: {floor} | тип: {ntype}')

        lines.append("\nАлиасы (синонимы):")
        for alias, node_id in self.aliases.items():
            nd = self.nodes_data.get(node_id, {})
            lines.append(f'  "{alias}" → id: "{node_id}" ({nd.get("label", "")})')

        return "\n".join(lines)

    def resolve_by_id(self, node_id: str) -> Optional[str]:
        if node_id in self.nodes_data:
            return node_id
        return None

    def resolve_destination(self, query: str) -> Optional[str]:
        raw_query = query.lower().strip()
        q = _normalize_query(query)

        logger.debug("resolve_destination: raw='%s' cleaned='%s'", raw_query, q)

        if not q:
            return None

        if q in self.nodes_data:
            return q

        if q.isdigit():
            candidate = f"room_{q}"
            if candidate in self.nodes_data:
                return candidate
            for nid, nd in self.nodes_data.items():
                if nd.get("label", "") == q:
                    return nid

        if q in self.aliases:
            return self.aliases[q]

        for alias, node_id in self.aliases.items():
            if alias in q or q in alias:
                return node_id

        for alias, node_id in self.aliases.items():
            if _stems_match(q, alias):
                return node_id

        for nid, nd in self.nodes_data.items():
            label = nd.get("label", "")
            if not label:
                continue
            if label.lower() == q:
                return nid
            if _stems_match(q, label):
                return nid

        for nid, nd in self.nodes_data.items():
            name = nd.get("name", "")
            if name and _stems_match(q, name):
                return nid

        query_words = [w for w in q.split() if len(w) > 2]
        for word in query_words:
            for alias, node_id in self.aliases.items():
                if _stems_match(word, alias):
                    return node_id
            for nid, nd in self.nodes_data.items():
                label = nd.get("label", "")
                name = nd.get("name", "")
                if _stems_match(word, label) or (name and _stems_match(word, name)):
                    return nid

        logger.warning("Назначение не найдено: '%s' (cleaned: '%s')", query, q)
        return None

    # ── Поиск пути ───────────────────────────────────────────────
    def find_path(self, destination_id: str, start_id: str | None = None) -> Optional[Dict]:
        start_id = start_id or self.robot_position

        if start_id not in self.graph or destination_id not in self.graph:
            return None

        try:
            path = nx.shortest_path(self.graph, start_id, destination_id, weight="weight")
            total_weight = nx.shortest_path_length(self.graph, start_id, destination_id, weight="weight")
        except nx.NetworkXNoPath:
            return None

        # Старый формат path_details (для описания маршрута словами)
        path_details = []
        floors = set()
        for nid in path:
            nd = self.nodes_data.get(nid, {})
            floor = nd.get("floor", 1)
            floors.add(floor)
            point = self._get_node_point(nid)
            path_details.append({
                "node_id": nid,
                "label": nd.get("label", nid),
                "floor": floor,
                "type": nd.get("type", "unknown"),
                "x": point["x"],
                "y": point["y"],
            })

        # Новый формат — точки для отрисовки линии
        visual_path = self._build_visual_path(path)

        description = self._describe_route(path_details)
        estimated_min = max(1, total_weight // 30)
        dest = self.nodes_data.get(destination_id, {})

        return {
            "path": path,
            "path_details": path_details,
            "visual_path": visual_path,       # ← НОВОЕ: точки для рисования
            "total_weight": total_weight,
            "floors": sorted(floors),
            "target_floor": dest.get("floor", 1),
            "estimated_time": f"{estimated_min} мин",
            "description": description,
            "destination_label": dest.get("label", destination_id),
        }

    def _describe_route(self, path_details: List[dict]) -> str:
        steps = []
        prev_floor = path_details[0]["floor"] if path_details else 1

        for i, node in enumerate(path_details):
            ntype = node["type"]
            label = node["label"]
            floor = node["floor"]

            if ntype == "hall" and i > 0:
                steps.append(f"пройдите через {label.lower()}")
            elif ntype == "stairs":
                for j in range(i + 1, len(path_details)):
                    if path_details[j]["type"] != "stairs":
                        target_floor = path_details[j]["floor"]
                        if target_floor > prev_floor:
                            steps.append(f"поднимитесь по лестнице на {target_floor} этаж")
                        elif target_floor < prev_floor:
                            steps.append(f"спуститесь по лестнице на {target_floor} этаж")
                        break
            elif ntype == "corridor":
                steps.append("пройдите по коридору")
            elif i == len(path_details) - 1:
                steps.append(f"{label} будет перед вами")

            prev_floor = floor

        if not steps:
            return "Место находится рядом"
        return ". ".join(s.capitalize() for s in steps)

    def get_all_rooms(self) -> List[dict]:
        return [
            nd for nd in self.nodes_data.values()
            if nd.get("type") not in ("corridor", "stairs",)
        ]

    def get_nodes_json(self) -> List[dict]:
        return list(self.nodes_data.values())

    def get_edges_json(self) -> List[dict]:
        return [
            {"from": u, "to": v, **data}
            for u, v, data in self.graph.edges(data=True)
        ]