# MOTOFIX — Services Runbook

Quick reference for running, deploying, and troubleshooting the MOTOFIX microservices platform.

---

## Service Map

| Folder | SDD Module Name | Type | Port | Database | Independent? |
|---|---|---|---|---|---|
| `motofix-auth-service` | User Registration and Authentication Service | Python / FastAPI | **8000** | `motofix_auth` | Yes |
| `motofix-service-requests` | Request and Dispatch Management Service | Python / FastAPI | **8001** | `motofix_service_requests` | Yes (notifications optional) |
| `motofix-mechanics-service` | Mechanic Verification Service | Python / FastAPI | **8002** | `motofix_mechanics` | Yes |
| `motofix-payments-service` | Payments and Billing Service | Python / FastAPI | **8003** | `motofix_payments` | Yes |
| `motofix-notifications-service` | Notifications and Alerts Service | Python / FastAPI | **8004** | None (stateless) | Yes |
| `motofix-admin-dashboard` | Analytics and Reporting Service | Python / FastAPI | **8005** | `motofix_admin` | Yes |
| `motofix-mechanic-matching` | Intelligent Mechanic Matching Service | Python / FastAPI | **8006** | `motofix_matching` | Needs mechanics-service |
| `motofix-fault-diagnosis` | Fault Diagnosis and Classification Service | Python / FastAPI | **8007** | None (stateless) | Yes (needs OpenAI + Google Vision) |
| `motofix-driver-assist-app` | Driver Assist App (frontend) | React / Vite → nginx | **8080** | — | Needs auth + requests + payments |
| `motofix-mechanic-connect` | Mechanic Connect App (frontend) | React / Vite → nginx | **8081** | — | Needs mechanics + requests + payments |
| `motofix-control-center` | Control Center App (frontend) | React / Vite → nginx | **8082** | — | Needs admin-dashboard |

---

## Startup Order

When bringing up the full stack from scratch:

```
1.  PostgreSQL                      (all services depend on this)
2.  motofix-auth-service
3.  motofix-mechanics-service
4.  motofix-notifications-service   (no DB — starts immediately)
5.  motofix-fault-diagnosis         (no DB — starts immediately; needs OPENAI_API_KEY + GOOGLE_VISION_API_KEY)
6.  motofix-service-requests        (needs postgres; notifications optional)
7.  motofix-payments-service
8.  motofix-admin-dashboard
9.  motofix-mechanic-matching       (needs postgres + mechanics-service)
10. motofix-driver-assist-app       (frontend — can start any time)
11. motofix-mechanic-connect        (frontend — can start any time)
12. motofix-control-center          (frontend — can start any time)
```

Each backend service runs its own schema migrations on startup, so no manual migration steps are required on a fresh database.

---

## Running with Docker Compose (recommended)

```bash
# Start the full stack
docker compose up -d

# Start only the backend
docker compose up -d postgres auth-service mechanics-service \
    notifications-service service-requests payments-service admin-dashboard

# Rebuild a single service after code changes
docker compose build service-requests
docker compose up -d service-requests

# Tail logs for one service
docker compose logs -f service-requests

# Stop everything and remove volumes (fresh start)
docker compose down -v
```

### Overriding frontend API URLs at build time

Vite embeds API URLs into the JS bundle at build time. To point frontends at a
different backend (e.g. production), pass build args:

```bash
docker compose build \
  --build-arg VITE_API_AUTH_URL=https://auth.motofix.org \
  --build-arg VITE_API_REQUESTS_URL=https://requests.motofix.org \
  --build-arg VITE_API_PAYMENTS_URL=https://payments.motofix.org \
  driver-assist-app
```

---

## Running Locally (without Docker)

### Python backend services

```bash
# Each service follows the same pattern:
cd motofix-<service-name>
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # see note on encoding below
cp .env.example .env             # fill in values
uvicorn app.main:app --reload --port <port>
```

> **Note on requirements.txt encoding:** The requirements files are UTF-16 encoded.
> If `pip install -r requirements.txt` fails, convert first:
> ```bash
> iconv -f UTF-16 -t UTF-8 requirements.txt | pip install -r /dev/stdin
> ```

### React frontend services

```bash
cd motofix-<frontend-name>
npm install
cp .env.example .env.local        # fill in API URLs
npm run dev
```

---

## Environment Variables Reference

### Shared JWT Secret

All backend services that issue or validate JWT tokens must share the same `SECRET_KEY`.
This is intentional — it allows tokens from `motofix-auth-service` to be validated by
`motofix-service-requests`, `motofix-payments-service`, etc. without a separate token
exchange step.

**In production, generate a single strong key and set it in every service's `.env`:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Services that use `SECRET_KEY` for JWT:
- `motofix-auth-service` — issues driver tokens
- `motofix-mechanics-service` — issues mechanic tokens
- `motofix-service-requests` — validates both driver and mechanic tokens
- `motofix-payments-service` — validates both driver and mechanic tokens
- `motofix-admin-dashboard` — validates tokens; also has a separate `ADMIN_JWT_SECRET`

`motofix-notifications-service` does **not** use JWT — it is an internal-only service.

---

### motofix-auth-service (port 8000)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_auth`) |
| `SECRET_KEY` | Yes | JWT signing key — must match other services |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime (default: `43200` = 30 days) |
| `AT_USERNAME` | No | Africa's Talking username (`sandbox` for dev) |
| `AT_API_KEY` | No | Africa's Talking API key |
| `AT_FROM` | No | SMS sender name / shortcode |

---

### motofix-mechanics-service (port 8002)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_mechanics`) |
| `SECRET_KEY` | Yes | JWT signing key — must match other services |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime (default: `43200`) |

---

### motofix-service-requests (port 8001)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_service_requests`) |
| `SECRET_KEY` | Yes | JWT validation key for driver tokens |
| `DRIVER_SECRET_KEY` | No | Fallback key (defaults to `SECRET_KEY`) |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `SERVICE_VARIANT` | No | Feature flag set (`main` or `fyp`) |
| `NOTIFICATIONS_URL` | No | URL of notifications service (default: `http://localhost:8004`) |
| `STORAGE_PROVIDER` | No | `cloudinary` or `s3` for media uploads |
| `CLOUDINARY_*` | No | Cloudinary credentials (if `STORAGE_PROVIDER=cloudinary`) |
| `AWS_*` | No | AWS S3 credentials (if `STORAGE_PROVIDER=s3`) |
| `GOOGLE_GEOCODING_API_KEY` | No | Google Maps Geocoding API key |

---

### motofix-payments-service (port 8003)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_payments`) |
| `SECRET_KEY` | Yes | JWT validation key |
| `DRIVER_SECRET_KEY` | No | Fallback key |
| `PLATFORM_COMMISSION` | No | Commission per job in smallest currency unit (default: `10000`) |
| `MOMO_COLLECTIONS_USER_ID` | Yes (for payments) | MTN MoMo Collections user ID |
| `MOMO_COLLECTIONS_API_KEY` | Yes (for payments) | MTN MoMo Collections API key |
| `MOMO_COLLECTIONS_PRIMARY_KEY` | Yes (for payments) | MTN MoMo Collections primary key |
| `MOMO_DISBURSEMENTS_USER_ID` | Yes (for payouts) | MTN MoMo Disbursements user ID |
| `MOMO_DISBURSEMENTS_API_KEY` | Yes (for payouts) | MTN MoMo Disbursements API key |
| `MOMO_DISBURSEMENTS_PRIMARY_KEY` | Yes (for payouts) | MTN MoMo Disbursements primary key |
| `MOMO_ENV` | No | `sandbox` (dev) or production environment string |

---

### motofix-notifications-service (port 8004)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on (default: `8004`) |
| `AT_USERNAME` | Yes | Africa's Talking username (`sandbox` for dev) |
| `AT_API_KEY` | Yes | Africa's Talking API key |

---

### motofix-admin-dashboard (port 8005)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_admin`) |
| `SECRET_KEY` | Yes | JWT validation key — must match other services |
| `ADMIN_JWT_SECRET` | Yes | Separate secret for admin-specific tokens |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `PORT` | No | Port to listen on (default: `8005`) |
| `CORS_ORIGINS` | No | Comma-separated extra CORS origins |
| `ADMIN_PASSWORD` | No | Plain-text admin password (dev only) |
| `ADMIN_PASSWORD_HASH` | No | Bcrypt hash (use in production instead) |

---

### motofix-mechanic-matching (port 8006)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (`postgresql://...motofix_matching`) |
| `SECRET_KEY` | Yes | JWT validation key — must match other services |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `MECHANICS_SERVICE_URL` | No | URL of `motofix-mechanics-service` (default: `http://localhost:8002`) |

---

### motofix-fault-diagnosis (port 8007)

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | JWT validation key — must match other services |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `OPENAI_API_KEY` | Yes (for `/diagnose`, `/chat`) | OpenAI API key — get one at platform.openai.com |
| `GOOGLE_VISION_API_KEY` | Yes (for `/diagnose/image`) | Google Cloud Vision API key |

---

### motofix-driver-assist-app (port 8080)

| Variable | Build-time | Description |
|---|---|---|
| `VITE_API_AUTH_URL` | Yes | URL of `motofix-auth-service` |
| `VITE_API_REQUESTS_URL` | Yes | URL of `motofix-service-requests` |
| `VITE_API_PAYMENTS_URL` | Yes | URL of `motofix-payments-service` |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Google Maps JavaScript API key |

---

### motofix-mechanic-connect (port 8081)

| Variable | Build-time | Description |
|---|---|---|
| `VITE_API_URL` | Yes | URL of `motofix-mechanics-service` |
| `VITE_REQUESTS_URL` | Yes | URL of `motofix-service-requests` |
| `VITE_PAYMENTS_URL` | Yes | URL of `motofix-payments-service` |

---

### motofix-control-center (port 8082)

| Variable | Build-time | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | URL of `motofix-admin-dashboard` |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Google Maps JavaScript API key |

---

## Database Overview

All backend services connect to a **single PostgreSQL instance** but use **separate databases** — no cross-database foreign keys exist. Each service owns its schema entirely.

| Database | Owner service |
|---|---|
| `motofix_auth` | motofix-auth-service |
| `motofix_service_requests` | motofix-service-requests |
| `motofix_mechanics` | motofix-mechanics-service |
| `motofix_payments` | motofix-payments-service |
| `motofix_admin` | motofix-admin-dashboard |

When using Docker Compose, `init-databases.sql` creates all databases automatically on first boot.

---

## Health Checks

All backend services expose a `/health` endpoint that returns `200 OK`. The Docker Compose
healthchecks poll this endpoint to determine when a service is ready.

```bash
curl http://localhost:8000/health   # auth-service
curl http://localhost:8001/health   # service-requests
curl http://localhost:8002/health   # mechanics-service
curl http://localhost:8003/health   # payments-service
curl http://localhost:8004/health   # notifications-service
curl http://localhost:8005/health   # admin-dashboard
curl http://localhost:8006/health   # mechanic-matching
curl http://localhost:8007/health   # fault-diagnosis
```

---

## Production Deployment Notes

1. **Set a real `SECRET_KEY`** — the same value must be set in all services that share JWT validation.
2. **Separate the databases** — they can all live on one Postgres instance, but consider moving to RDS or a managed service in production.
3. **Never commit `.env` files** — use a secrets manager (AWS Secrets Manager, Render environment, etc.).
4. **Frontend env vars** — pass `VITE_*` values as Docker build args pointing to your production API URLs.
5. **MTN MoMo** — switch `MOMO_ENV` from `sandbox` to your country code for live payments.
6. **Africa's Talking** — change `AT_USERNAME` from `sandbox` to your production account.
