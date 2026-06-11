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

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
