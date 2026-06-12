# notifications (sub-service)

Notifications and alerts for the MOTOFIX platform — SMS / WhatsApp (Africa's
Talking) and push notifications (Firebase FCM). Bundled with
[motofix-analytics-service](../README.md).

- **Stack:** Python / FastAPI
- **Port:** 8004
- **Database:** writes to motofix_dispatch

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in AT + Firebase values
uvicorn app.main:app --reload --port 8004
```

Health check: `GET /health`.

See the [root README](../../../README.md) and
[docs/RUNBOOK.md](../../../docs/RUNBOOK.md) for the full platform overview.
