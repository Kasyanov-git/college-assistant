<div align="center">

# College Assistant

### Голосовой AI-помощник и интерактивный инфокиоск для колледжа

Отвечает на вопросы, помогает сориентироваться в здании и превращает обычный экран в удобную точку самообслуживания.

<br />

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/UI-React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)

</div>

---

## О проекте

**College Assistant** — full-stack приложение для сенсорного инфокиоска. Пользователь может общаться с помощником текстом или голосом, получать ответы по материалам колледжа и строить маршрут по интерактивной карте здания.

Интерфейс рассчитан на большой экран: стартовый экран, чат, навигация, информационные разделы и виджеты собраны в едином kiosk-friendly приложении.

## Возможности

- 💬 Диалог с AI-помощником через текстовый интерфейс и WebSocket.
- 🎙️ Распознавание речи с Vosk или Whisper.
- 🔊 Озвучивание ответов с Gemini или Yandex и резервными провайдерами.
- 📚 Поиск по локальной базе знаний на Markdown-документах: embeddings и ChromaDB.
- 🧭 Поиск маршрута по графу здания и отображение интерактивной карты.
- 🗓️ Встраиваемые страницы и информационные экраны.
- 🌦️ Виджет погоды и адаптируемая конфигурация киоска.
- 🖥️ Запуск веб-интерфейса вместе с FastAPI или отдельным dev-сервером Vite.

## Как устроен проект

```text
college-assistant/
├── backend/
│   ├── app/
│   │   ├── api/          # HTTP- и WebSocket-маршруты
│   │   ├── core/         # Оркестрация запросов
│   │   ├── db/           # Работа с базой данных
│   │   └── modules/      # LLM, RAG, речь и навигация
│   ├── data/             # Локальные данные; не публикуются
│   └── requirements.txt
├── frontend/
│   ├── src/              # React-интерфейс и экраны киоска
│   └── package.json
└── deploy/               # Вспомогательные файлы запуска киоска
```

### Технологии

| Область | Стек |
| --- | --- |
| Frontend | React, TypeScript, Vite, Zustand |
| Backend | Python, FastAPI, Pydantic |
| AI и поиск | GigaChat / Ollama, Sentence Transformers, ChromaDB |
| Голос | Vosk / Whisper, Gemini TTS / Yandex SpeechKit |
| Навигация и данные | NetworkX, SQLite, SQLAlchemy |

## Локальный запуск

### Требования

- Python 3.12
- Node.js 20 или новее и npm
- Интернет при первом запуске для загрузки модели эмбеддингов
- API-учётные данные выбранных AI-провайдеров
- Файлы модели распознавания речи и данные колледжа — если нужны голосовой ввод, база знаний и навигация

### 1. Настройте backend

Команды ниже приведены для PowerShell:

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Откройте `backend/.env` и добавьте необходимые учётные данные. Шаблон содержит только пустые значения и безопасные настройки по умолчанию.

По умолчанию распознавание настроено на Vosk. Скачайте подходящую русскоязычную модель Vosk и укажите фактический путь к распакованной модели в `VOSK_MODEL_PATH`. Для Whisper измените `STT_PROVIDER` и при необходимости `WHISPER_MODEL_SIZE`.

### 2. Подготовьте локальные данные

Файлы из `backend/data/` намеренно не входят в репозиторий. Перед запуском добавьте свои данные:

- Markdown-документы для поиска — в `backend/data/knowledge/`;
- JSON-граф здания — по пути `backend/data/maps/building_graph.json`;
- модель Vosk — в каталог, заданный `VOSK_MODEL_PATH`.

Индекс ChromaDB, SQLite-база и аудиокэш создаются локально. Не добавляйте в публичный репозиторий документы, карты, записи или базы с персональными и непубличными сведениями.

### 3. Запустите интерфейс

В отдельном окне PowerShell:

```powershell
cd frontend
npm ci
npm run dev
```

Vite запустит интерфейс на `http://localhost:3000` и перенаправит API-запросы на backend. В первом окне, находясь в каталоге `backend`, запустите:

```powershell
python run_desktop.py
```

Для проверки API откройте `http://localhost:8000/health`.

### Production-сборка интерфейса

```powershell
cd frontend
npm ci
npm run build
```

Сборка попадёт в `frontend/dist`; при запуске backend из каталога `backend` FastAPI сможет отдавать её как веб-интерфейс.

## Конфигурация AI-провайдеров

Скопируйте `backend/.env.example` в `backend/.env`, затем выберите провайдеры в переменных `LLM_PROVIDER`, `STT_PROVIDER`, `TTS_PROVIDER` и соответствующих fallback-переменных.

| Переменная | Назначение |
| --- | --- |
| `GIGACHAT_CREDENTIALS` | Данные авторизации GigaChat |
| `GEMINI_API_KEY` | Ключ Gemini для синтеза речи |
| `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` | Учётные данные Yandex SpeechKit |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Адрес локального Ollama и имя модели |
| `KNOWLEDGE_DIR` | Каталог Markdown-документов |
| `BUILDING_GRAPH_PATH` | Путь к JSON-графу здания |
| `DATABASE_URL` | Строка подключения к базе данных |

Не используйте настоящие ключи в примерах, скриншотах, issue или коммитах. Если ключ уже попал в историю Git или был опубликован, отзовите его у провайдера и выпустите новый.

## API

- `GET /health` — состояние API и активные провайдеры.
- `POST /api/chat/message` — текстовый запрос к помощнику.
- `WS /api/ws/chat` — потоковый обмен сообщениями, включая голосовые запросы.
- `/api/map`, `/api/articles`, `/api/weather`, `/api/embed` — навигация, материалы, погода и поддержка встраиваемых страниц.

Интерактивная документация FastAPI доступна по адресу `http://localhost:8000/docs`.

## Безопасность и публикация

- `.env`, локальные базы, модели, кеши, аудиофайлы, `node_modules` и результаты сборки исключены через `.gitignore`.
- Реальные данные доступа храните только в локальном `.env` или в менеджере секретов.
- Перед публикацией проверьте содержимое коммитов и убедитесь, что в них нет личных данных, приватных материалов и файлов, на распространение которых у вас нет разрешения.
- Для публичного сервера отдельно настройте CORS, доступ к API и хранение загружаемых данных; локальный kiosk-конфиг не следует без проверки использовать как production-конфигурацию.

## Лицензия

Лицензия пока не указана. Перед публичным распространением добавьте лицензию, соответствующую вашим правам на код и включённые материалы.
