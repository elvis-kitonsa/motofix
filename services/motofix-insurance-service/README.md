# motofix-insurance-service

Insurance for the MOTOFIX platform — vehicle insurance quotes and claims.

- **Stack:** Python / FastAPI
- **Port:** 8006
- **Database:** motofix_insurance

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in values
uvicorn app.main:app --reload --port 8006
```

## Endpoints

Interactive API docs at `/docs`. Main groups:

| Group | Examples |
|-------|----------|
| Insurers | `GET /insurers` (catalog of insurers to choose from) |
| Cover applications | `POST /applications`, `GET /applications`, `PATCH /applications/{reference}/status` |
| Claims | `POST /claims`, `GET /claims`, `GET /claims/{reference}`, `PATCH /claims/{reference}/status` |
| System | `GET /health` |

## Configuration (environment)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (motofix_insurance). |
| `SECRET_KEY` / `ALGORITHM` | JWT verification (must match the other services). |
| `UPLOADS_DIR` | Where uploaded claim documents/photos are stored. |

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
