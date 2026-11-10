# backend/app/modules/rag/knowledge_base.py

import os
import logging
import hashlib
from pathlib import Path
from typing import List, Dict

import chromadb
from sentence_transformers import SentenceTransformer

from app.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "college_knowledge"


class KnowledgeBase:
    def __init__(self):
        logger.info("Загрузка модели эмбеддингов: %s", settings.embedding_model)
        self.embedder = SentenceTransformer(settings.embedding_model)

        os.makedirs(settings.chroma_persist_dir, exist_ok=True)

        self.client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB: %d документов в базе", self.collection.count())

    def _stored_embedding_model(self) -> str | None:
        meta = self.collection.metadata or {}
        return meta.get("embedding_model")

    def _reset_collection(self):
        try:
            self.client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={
                "hnsw:space": "cosine",
                "embedding_model": settings.embedding_model,
                "knowledge_version": knowledge_version if "knowledge_version" in locals() else "",
            },
        )

    def load_documents(self, force_reload: bool = False):
        """Загрузить markdown-документы из директории знаний."""
        stored_model = self._stored_embedding_model()
        if stored_model and stored_model != settings.embedding_model:
            output.sort(key=lambda item: item["score"], reverse=True)
            output = output[:top_k]
            logger.info(
                "Смена модели эмбеддингов (%s → %s), переиндексация",
                stored_model,
                settings.embedding_model,
            )
            force_reload = True

        knowledge_path = Path(settings.knowledge_dir)
        if not knowledge_path.exists():
            logger.warning("Папка знаний не найдена: %s", knowledge_path)
            return

        md_files = list(knowledge_path.glob("*.md"))
        if not md_files:
            logger.warning("Нет .md файлов в %s", knowledge_path)
            return

        knowledge_version = self._knowledge_version(md_files)
        stored_version = (self.collection.metadata or {}).get("knowledge_version")
        if stored_version and stored_version != knowledge_version:
            logger.info("Файлы базы знаний изменились — переиндексация")
            force_reload = True

        if self.collection.count() > 0 and not force_reload:
            if self._stored_embedding_model() is None:
                logger.info("Индекс без метки модели эмбеддингов — переиндексация")
                force_reload = True
            else:
                logger.info("База знаний уже загружена, пропускаем (count=%d)", self.collection.count())
                return

        if force_reload and self.collection.count() > 0:
            self._reset_collection()
        elif self.collection.count() == 0:
            # self.collection.modify(
            #     metadata={
            #         "hnsw:space": "cosine",
            #         "embedding_model": settings.embedding_model,
            #     }
            # )
            self._reset_collection()

        documents = []
        metadatas = []
        ids = []

        for file_path in md_files:
            content = file_path.read_text(encoding="utf-8")
            chunks = self._chunk_markdown(content, file_path.stem)

            for i, chunk in enumerate(chunks):
                doc_id = f"{file_path.stem}_{i}"
                documents.append(chunk["text"])
                metadatas.append({
                    "source": file_path.name,
                    "section": chunk["section"],
                    "category": file_path.stem,
                })
                ids.append(doc_id)

        if not documents:
            return

        logger.info("Генерация эмбеддингов для %d чанков...", len(documents))
        embeddings = self.embedder.encode(
            [f"passage: {d}" for d in documents],
            show_progress_bar=len(documents) > 20,
        ).tolist()

        self.collection.upsert(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )
        # self.collection.modify(
        #     metadata={
        #         "hnsw:space": "cosine",
        #         "embedding_model": settings.embedding_model,
        #     }
        # )
        logger.info("✅ Загружено %d чанков в базу знаний", len(documents))

    @staticmethod
    def _knowledge_version(files: List[Path]) -> str:
        digest = hashlib.sha256()
        for file_path in sorted(files):
            digest.update(str(file_path.relative_to(file_path.parent.parent)).encode("utf-8"))
            digest.update(file_path.read_bytes())
        return digest.hexdigest()

    def search(self, query: str, top_k: int | None = None) -> List[Dict]:
        if self.collection.count() == 0:
            return []

        top_k = top_k or settings.rag_top_k

        query_emb = self.embedder.encode([f"query: {query}"]).tolist()

        results = self.collection.query(
            query_embeddings=query_emb,
            n_results=min(max(top_k * 3, top_k), self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        if not results["documents"] or not results["documents"][0]:
            return []

        output = []
        for i in range(len(results["documents"][0])):
            distance = results["distances"][0][i]
            score = round(1 - distance, 3)
            if distance > (1 - settings.rag_min_score):
                continue
            output.append({
                "text": results["documents"][0][i],
                "source": results["metadatas"][0][i].get("source", ""),
                "section": results["metadatas"][0][i].get("section", ""),
                "score": score,
            })

        logger.info(
            "RAG поиск '%s' → %d результатов (top score=%s)",
            query[:40],
            len(output),
            output[0]["score"] if output else "—",
        )
        return output

    @staticmethod
    def _chunk_markdown(
        text: str,
        source: str,
        max_size: int = 800,  # Чуть увеличим для вместимости заголовков
        overlap: int = 150,
    ) -> List[Dict]:
        chunks: List[Dict] = []
        current_header = ""
        current_lines: List[str] = []
        current_size = 0

        def flush_chunk():
            nonlocal current_lines, current_size
            if not current_lines:
                return
            
            # Собираем текст чанка
            body = "\n".join(current_lines).strip()
            
            # Если чанк не начинается с заголовка, принудительно добавляем контекст
            if current_header and not body.startswith("##"):
                body = f"{current_header}\n{body}"
                
            if body:
                chunks.append({
                    "text": body, 
                    "section": current_header.lstrip("# ").strip() if current_header else source
                })
            
            # Реализуем скользящее окно (overlap) по строкам
            # Оставляем примерно 3-4 последние строки для контекста следующего чанка
            overlap_lines = current_lines[-3:] if len(current_lines) > 3 else []
            current_lines = list(overlap_lines)
            current_size = sum(len(line) + 1 for line in current_lines)

        for line_raw in text.split("\n"):
            line = line_raw.strip()
            
            # Обнаружили новый заголовок секции
            if line.startswith("## ") or line.startswith("### "):
                # Перед тем как переключить заголовок, сбрасываем старый чанк
                if current_lines:
                    flush_chunk()
                current_header = line_raw  # Сохраняем заголовок со всеми решетками
                current_lines = [line_raw]
                current_size = len(line_raw) + 1
                continue

            # Добавляем строку в текущий чанк
            current_lines.append(line_raw)
            current_size += len(line_raw) + 1

            # Если превысили лимит размера — бережно сбрасываем чанк
            if current_size > max_size:
                flush_chunk()

        # Сбрасываем остатки текста
        if current_lines:
            # Проверяем, не остался ли там только заголовок
            body_test = "\n".join(current_lines).strip()
            if body_test != current_header:
                flush_chunk()

        return chunks