# backend/Dockerfile

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Скачиваем Vosk модель
RUN mkdir -p data/vosk_model && \
    python -c "\
import urllib.request, zipfile, os; \
url='https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip'; \
urllib.request.urlretrieve(url, '/tmp/m.zip'); \
zipfile.ZipFile('/tmp/m.zip').extractall('data/vosk_model'); \
os.remove('/tmp/m.zip')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]