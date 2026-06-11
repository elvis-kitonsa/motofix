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

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
