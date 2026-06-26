# motofix-matching-service

Intelligent mechanic matching for the MOTOFIX platform. Scores and ranks nearby
providers for a request, including the capability gate that routes breakdown
requests only to providers able to handle them.

- **Stack:** Python / FastAPI
- **Port:** 8003
- **Database:** motofix_matching
- **Depends on:** verification-service (for provider data)

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in values
uvicorn app.main:app --reload --port 8003
```

## Endpoints

Interactive API docs at `/docs`. All endpoints require a valid login token.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/match` | Rank verified, available mechanics for a request (location + problem type); skips anyone who already declined this request. |
| POST | `/dispatch/{request_id}/outcome` | Record a mechanic's response (accepted / declined / expired). |
| GET  | `/dispatch/{request_id}/history` | Dispatch history for a request. |
| GET  | `/health` | Liveness check. |

## Configuration (environment)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (motofix_matching). |
| `SECRET_KEY` / `ALGORITHM` | JWT verification (must match the other services). |
| `MECHANICS_SERVICE_URL` | Verification service URL, used to fetch the candidate mechanic pool. |

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
