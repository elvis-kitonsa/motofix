# MOTOFIX

A microservices platform connecting drivers with verified mechanics for on-demand
roadside assistance and vehicle repair — with dispatch, matching, payments,
notifications, fault diagnosis, and analytics.

## Architecture

MOTOFIX is split into independent backend services (Python / FastAPI) and frontend
interfaces (React / Vite), all backed by a single PostgreSQL instance where each
service owns its own database.

| Service | Description | Port |
|---|---|---|
| `motofix-auth-service` | User registration & authentication | 8000 |
| `motofix-dispatch-service` | Request & dispatch management | 8001 |
| `motofix-verification-service` | Mechanic verification | 8002 |
| `motofix-matching-service` | Intelligent mechanic matching | 8003 |
| `motofix-analytics-service` | Analytics & reporting | 8005 |
| `motofix-insurance-service` | Insurance | 8006 |
| `motofix-diagnosis-service` | Fault diagnosis & classification | 8007 |
| `motofix-core` | Shared utilities & models | 8008 |
| notifications | Notifications & alerts (SMS / WhatsApp / push) | 8004 |

| Interface | Description | Port |
|---|---|---|
| `motofix-driver-app` | Driver app | 8083 |
| `motofix-service-provider-app` | Mechanic / provider dashboard | 8084 |
| `motofix-admin-portal` | Admin control center | 8082 |

## Getting started

```bash
# Bring up the full stack
docker compose up -d

# Tail logs for one service
docker compose logs -f dispatch-service
```

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for the full runbook: startup order,
environment variables, health checks, and deployment notes.

## Configuration

Each service reads its configuration from a local `.env` file. **These are never
committed** — copy from the relevant `.env.example` and fill in your own values
(API keys, database URLs, JWT secrets).

## License

Proprietary — all rights reserved.
