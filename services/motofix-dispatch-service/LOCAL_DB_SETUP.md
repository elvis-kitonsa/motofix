# Local Database Setup for motofix-service-requests

This service requires a PostgreSQL database for local development.
It uses `DATABASE_URL` and connects with `asyncpg`, so SQLite is not supported at runtime here.

## 1. Install PostgreSQL locally

### Option A: Use Docker (recommended)

If Docker Desktop is installed, start the daemon and run:

```powershell
docker compose -f ..\docker-compose.postgres.yml up -d
```

If Docker Desktop is not running, start it first and then run the command above.

If you prefer a one-off container instead, use:

```powershell
docker run --name motofix-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=motofix_service_requests -p 5432:5432 -d postgres:15
```

### Option B: Install PostgreSQL for Windows

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. During setup, create a user `postgres` and password `password` (or choose your own)
3. Create the database manually if needed:

```powershell
psql -U postgres -c "CREATE DATABASE motofix_service_requests;"
```

## 2. Configure `.env`

Copy the example file and update the connection string:

```powershell
cd motofix-service-requests
copy .env.example .env
```

Edit `.env` and confirm the following values:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/motofix_service_requests
SECRET_KEY=some_secret_value
DRIVER_SECRET_KEY=some_secret_value
ALGORITHM=HS256
SERVICE_VARIANT=main
```

If you use a different PostgreSQL user/password/database, update the URL accordingly.

## 3. Start the backend service

```powershell
cd motofix-service-requests
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## 4. Verify the database connection

Open another terminal and run:

```powershell
curl http://localhost:8001/health
```

You should see a healthy response like:

```json
{ "status": "healthy" }
```

If the backend cannot connect, the logs will show the `DATABASE_URL` and the connection error.

## 5. Notes

- `motofix-service-requests` depends on a PostgreSQL server on port `5432` by default.
- If the database is not reachable, startup will still run but DB operations will fail.
- Use the local `psql` client or Docker logs to verify the database is running.
