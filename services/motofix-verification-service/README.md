# motofix-verification-service

Mechanic verification and approval for the MOTOFIX platform. Manages provider
applications and verification status used by matching and dispatch.

- **Stack:** Python / FastAPI
- **Port:** 8002
- **Database:** motofix_mechanics

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in values
uvicorn app.main:app --reload --port 8002
```

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
