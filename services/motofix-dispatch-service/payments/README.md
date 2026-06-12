# payments (sub-service)

Payments and billing for the MOTOFIX platform — MTN MoMo collections (job
payments) and disbursements (provider payouts), plus the platform commission.
Bundled with [motofix-dispatch-service](../README.md).

- **Stack:** Python / FastAPI
- **Database:** motofix_dispatch

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in DB, JWT and MoMo credentials
```

See the [root README](../../../README.md) and
[docs/RUNBOOK.md](../../../docs/RUNBOOK.md) for the full platform overview.
