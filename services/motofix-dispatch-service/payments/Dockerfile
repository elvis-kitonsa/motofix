FROM python:3.11-slim

WORKDIR /app

# iconv is needed because requirements.txt is UTF-16 encoded
RUN apt-get update && apt-get install -y --no-install-recommends \
    iconv \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN iconv -f UTF-16 -t UTF-8 requirements.txt > requirements_utf8.txt \
    && pip install --no-cache-dir -r requirements_utf8.txt \
    && rm requirements_utf8.txt

COPY . .

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
