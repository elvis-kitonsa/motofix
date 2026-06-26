# motofix-analytics-service

Analytics and reporting for the MOTOFIX platform. Backs the admin portal with
reporting, admin authentication, and provider subscriptions, and bundles the
notifications sub-service (SMS / WhatsApp / push).

- **Stack:** Python / FastAPI
- **Port:** 8005 (notifications sub-service: 8004)
- **Databases:** reads motofix_dispatch and motofix_auth

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in values
uvicorn app.main:app --reload --port 8005
```

The notifications sub-service lives in [`notifications/`](notifications/) with its
own `.env.example`.

## Endpoints

Interactive API docs at `/docs`. Main groups:

| Group | Examples |
|-------|----------|
| Admin auth (`/api`) | `POST /api/login`, `POST /api/login/admin` |
| Admin dashboard (`/admin`) | `GET /admin/requests`, `GET|POST|PATCH|DELETE /admin/mechanics[/{id}]`, `GET /admin/towing-providers`, `GET /admin/payments`, `GET /admin/live-stats`, `GET /admin/map-data`, `GET /admin/stats`, `GET /admin/dashboard/revenue-chart`, `GET|POST /admin/logs`, `GET /admin/compliance/report`, `GET /admin/subscriptions`, `POST /admin/subscriptions/record-payment`, `GET /admin/notifications` |
| Subscriptions (`/subscriptions`) | `GET /subscriptions/me` (a mechanic's own subscription status) |
| System | `GET /health` (no DB), `GET /health-db` (DB connectivity), `GET /` |

## Configuration (environment)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Dispatch DB read connection (motofix_dispatch). |
| `AUTH_DATABASE_URL` | Auth DB read connection (motofix_auth). |
| `ADMIN_JWT_SECRET` | Signing key for admin tokens. |
| `ADMIN_TOKEN_EXPIRE_MINUTES` | Admin token lifetime. |
| `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD` | Admin login credential (hash preferred). |
| `SECRET_KEY` / `ALGORITHM` | Verify mechanic JWTs for `/subscriptions/me`. |
| `CORS_ORIGINS` | Extra allowed origins (comma-separated), merged with the defaults. |

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
