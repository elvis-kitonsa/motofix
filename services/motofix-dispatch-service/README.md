# motofix-dispatch-service

Request and dispatch management — the core request lifecycle for the MOTOFIX
platform: creating assistance requests, dispatching to providers, realtime job
updates over websocket, media uploads, and payments (MTN MoMo / Airtel).

- **Stack:** Python / FastAPI
- **Port:** 8001
- **Database:** motofix_dispatch
- **Talks to:** matching-service, notifications, verification-service

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in values (DB, JWT, MoMo/Airtel, storage)
uvicorn app.main:app --reload --port 8001
```

Health check: `GET /health`. Websocket: `ws://localhost:8001/ws/jobs`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
