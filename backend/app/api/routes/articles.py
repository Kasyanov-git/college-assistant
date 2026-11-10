from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

router = APIRouter()


def _slugify(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"[^a-zа-я0-9]+", "-", text, flags=re.IGNORECASE)
    return text.strip("-") or "item"


def _safe_rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _label_from_name(path: Path) -> str:
    name = path.stem if path.is_file() else path.name
    return name.replace("_", " ").replace("-", " ").strip() or name


def _articles_root() -> Path:
    return Path(settings.college_articles_dir)


def _tree_node(dir_path: Path, root: Path) -> dict[str, Any]:
    children: list[dict[str, Any]] = []

    dirs = sorted([p for p in dir_path.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    files = sorted(
        [p for p in dir_path.iterdir() if p.is_file() and p.suffix.lower() == ".md"],
        key=lambda p: p.name.lower(),
    )

    for d in dirs:
        children.append(_tree_node(d, root))
    for f in files:
        children.append(
            {
                "id": _safe_rel(f, root),
                "type": "article",
                "title": _label_from_name(f),
                "slug": _safe_rel(f, root),
            }
        )

    return {
        "id": _safe_rel(dir_path, root) if dir_path != root else "root",
        "type": "folder",
        "title": _label_from_name(dir_path) if dir_path != root else "О колледже",
        "children": children,
    }


@router.get("/tree")
async def get_articles_tree():
    root = _articles_root()
    if not root.exists():
        root.mkdir(parents=True, exist_ok=True)
    return _tree_node(root, root)


@router.get("/article")
async def get_article(slug: str):
    root = _articles_root().resolve()
    article_path = (root / slug).resolve()
    if root not in article_path.parents and article_path != root:
        raise HTTPException(status_code=400, detail="invalid article path")
    if not article_path.is_file() or article_path.suffix.lower() != ".md":
        raise HTTPException(status_code=404, detail="article not found")

    text = article_path.read_text(encoding="utf-8")
    return {
        "slug": _safe_rel(article_path, root),
        "title": _label_from_name(article_path),
        "markdown": text,
    }


class SpeakArticleRequest(BaseModel):
    slug: str
    text: str


class ClearArticleAudioRequest(BaseModel):
    slug: str
    text: str


def _article_audio_pattern(slug: str, text: str) -> str:
    slug_token = _slugify(Path(slug).stem)
    text_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
    return f"article_{slug_token}_{text_hash}.*"


@router.post("/speak")
async def speak_article(body: SpeakArticleRequest, request: Request):
    tts = request.app.state.tts
    cache_dir = Path(settings.article_audio_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty article text")

    existing = sorted(cache_dir.glob(_article_audio_pattern(body.slug, text)))
    if existing:
        return {
            "audio_url": f"/audio_articles/{existing[0].name}",
            "cached": True,
        }

    audio_path = await tts.synthesize(text)
    if not audio_path:
        raise HTTPException(status_code=500, detail="tts synthesize failed")

    src = Path(audio_path)
    if not src.exists():
        raise HTTPException(status_code=500, detail="tts file not found")

    slug_token = _slugify(Path(body.slug).stem)
    text_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
    target = cache_dir / f"article_{slug_token}_{text_hash}{src.suffix}"
    if src.resolve() != target.resolve():
        src.replace(target)

    return {
        "audio_url": f"/audio_articles/{target.name}",
        "cached": False,
    }


@router.post("/clear_audio")
async def clear_article_audio(body: ClearArticleAudioRequest):
    cache_dir = Path(settings.article_audio_cache_dir)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty article text")

    removed = 0
    for f in cache_dir.glob(_article_audio_pattern(body.slug, text)):
        f.unlink(missing_ok=True)
        removed += 1

    return {"removed": removed}
