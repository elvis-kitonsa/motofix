# MOTOFIX

[![CI](https://github.com/elvis-kitonsa/motofix/actions/workflows/ci.yml/badge.svg)](https://github.com/elvis-kitonsa/motofix/actions/workflows/ci.yml)
[![License: Proprietary](https://img.shields.io/badge/license-proprietary-red.svg)](LICENSE)

**On-demand roadside assistance and mechanic dispatch for Uganda.** MOTOFIX
connects drivers who break down with nearby verified mechanics, tow trucks, and
breakdown specialists — with live tracking, AI fault diagnosis, mobile-money
payments, spare-parts sourcing, and insurance, all on one platform.

> Three apps (driver, mechanic/provider, admin) over a set of independent
> FastAPI microservices backed by PostgreSQL.

---

## Screenshots

_Coming soon — driver app, mechanic app, and admin portal._

---

## Features

### 🚗 Driver app
- Request a **mechanic, tow truck, or breakdown specialist** and watch them arrive live on the map
- **MOTOBOT** AI assistant — describe the fault by text, photo, or voice; get a repair-vs-replace cost estimate before you commit
- **Spare parts** sourcing from real nearby dealers, and **fuel station** finder
- **Insurance** — compare insurers, apply for cover, and file claims
- Maintenance **reminders**, **SOS** emergency flow, and pay by **MoMo or cash**

### 🔧 Mechanic / provider app
- Receive and accept incoming job requests with full context (issue, photos, AI verdict)
- Guided **active-job** workflow with live navigation to the driver
- **Earnings** and per-job **platform-fee** balance with mobile-money settlement
- Spare-parts lookup and provider profile management

### 📊 Admin portal
- Analytics, reporting, and **breakdown hotspot** maps
- Provider management, verification, and **strike / reinstatement** handling
- Platform-wide oversight of requests, mechanics, and fees

---

## Architecture

A single PostgreSQL instance hosts a separate database per service — no
cross-database foreign keys; each service owns its schema.

### Backend services (Python / FastAPI)

| Service | Responsibility | Port | Database |
|---|---|---|---|
| `motofix-auth-service` | Registration & authentication (driver/provider/admin) | 8000 | `motofix_auth` |
| `motofix-dispatch-service` | Request & dispatch lifecycle, payments, platform fees, websocket | 8001 | `motofix_dispatch` |
| `motofix-verification-service` | Mechanic verification & approval | 8002 | `motofix_mechanics` |
| `motofix-matching-service` | Intelligent mechanic matching & capability gate | 8003 | `motofix_matching` |
| `motofix-analytics-service` | Analytics, reporting, admin auth, subscriptions | 8005 | reads `motofix_dispatch` / `motofix_auth` |
| `motofix-insurance-service` | Insurance quotes, applications & claims | 8006 | `motofix_insurance` |
| `motofix-diagnosis-service` | AI fault diagnosis, MOTOBOT chat, voice & image | 8007 | stateless |
| `motofix-core` | Shared utilities & models | 8008 | — |
| notifications _(sub-service)_ | SMS / WhatsApp / push (FCM) | 8004 | — |

### Frontend apps (React + Vite + TypeScript)

| App | Audience | Port |
|---|---|---|
| `motofix-driver-app` | Drivers | 8083 |
| `motofix-service-provider-app` | Mechanics / providers | 8084 |
| `motofix-admin-portal` | Administrators | 8082 |

---

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy / Alembic, PostgreSQL, WebSockets
- **Frontend:** React, Vite, TypeScript, Google Maps
- **AI:** OpenAI / Google Vision (diagnosis), Groq Whisper (voice)
- **Integrations:** MTN MoMo & Airtel Money (payments), Africa's Talking (SMS/WhatsApp), Firebase FCM (push)
- **Infra:** Docker / Docker Compose

---

## Project structure

```
motofix/
├── interfaces/                      # Frontend apps (React + Vite + TypeScript)
│   ├── motofix-driver-app/          #   driver-facing app
│   ├── motofix-service-provider-app/#   mechanic / provider dashboard
│   └── motofix-admin-portal/        #   admin control center
├── services/                        # Backend microservices (Python / FastAPI)
│   ├── motofix-auth-service/        #   each: app/, alembic/, Dockerfile,
│   ├── motofix-dispatch-service/    #   requirements.txt, .env.example, README
│   ├── motofix-verification-service/
│   ├── motofix-matching-service/
│   ├── motofix-analytics-service/   #   (+ notifications sub-service)
│   ├── motofix-insurance-service/
│   ├── motofix-diagnosis-service/
│   └── motofix-core/
├── database/
│   └── init-databases.sql           # creates the per-service databases
├── docs/
│   ├── RUNBOOK.md                   # ops runbook (startup order, env, health)
│   └── screenshots/
├── scripts/
│   └── heal-services.ps1            # recover backend after Docker hiccups
├── .github/workflows/ci.yml         # build apps + syntax-check services
├── docker-compose.yml               # full-stack orchestration
└── .env.example                     # root env template
```

A typical service has `app/` (routers, models, schemas, services), `alembic/`
migrations, a `Dockerfile`, `requirements.txt`, and its own `.env.example`.

---

## Getting started

### Run the full stack with Docker (recommended)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Bring up everything (Postgres, all services, all apps)
docker compose up -d

# 3. Tail logs for a service
docker compose logs -f dispatch-service
```

Apps are then served at:
- Driver app → http://localhost:8083
- Provider app → http://localhost:8084
- Admin portal → http://localhost:8082

### Run a single backend service locally

```bash
cd services/motofix-<name>
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt     # note: requirements.txt is UTF-16 encoded
cp .env.example .env                # fill in values
uvicorn app.main:app --reload --port <port>
```

### Run a single frontend app locally

```bash
cd interfaces/motofix-<app>
npm install
cp .env.example .env.local          # fill in API URLs and keys
npm run dev
```

Each service and app has its own `README.md` with specifics.

---

## Configuration

Configuration is via `.env` files (never committed). Copy the relevant
`.env.example` and fill in your own values:

- **Root `.env`** — values `docker-compose` injects (Maps, Firebase, Africa's Talking, MoMo, Airtel)
- **Per-service `.env`** — database URL, JWT secrets, and service-specific keys
- **Per-app `.env.local`** — `VITE_*` API URLs and client keys (baked in at build time)

> **Security:** the Firebase **service-account key**, Africa's Talking key, and
> payment credentials are real secrets — keep them out of git. The `VITE_FIREBASE_*`
> and Maps keys are public-by-design client keys, but should still be restricted by
> HTTP referrer in the Google Cloud / Firebase consoles.

---

## Continuous integration

Every push and pull request to `main` runs [CI](.github/workflows/ci.yml): it
builds all three frontend apps and syntax-checks the Python services.

## Documentation

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for the operational runbook — startup
order, full environment-variable reference, health checks, and deployment notes.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
