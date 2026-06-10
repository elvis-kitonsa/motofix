# motofix-mechanics-service: app/main.py

import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

load_dotenv()

from app.routers import mechanics
from app.routers import auth as auth_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ────────────────────────────── DATABASE POOL ──────────────────────────────
pool: asyncpg.Pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    pool = await asyncpg.create_pool(dsn=dsn, min_size=2, max_size=10, command_timeout=10)
    logger.info("✅ Mechanics service: Database pool created successfully")

    # Ensure mechanics table exists before running column migrations
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS mechanics (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                phone TEXT UNIQUE NOT NULL,
                email TEXT,
                location TEXT DEFAULT '',
                rating FLOAT DEFAULT 0.0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
    logger.info("✅ mechanics table ensured")

    # Safe migrations — add any missing columns (all idempotent)
    migrations = [
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS password_hash TEXT",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT 'General Repair'",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'car'",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS jobs_completed INTEGER DEFAULT 0",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS latitude FLOAT",
        "ALTER TABLE mechanics ADD COLUMN IF NOT EXISTS longitude FLOAT",
    ]
    try:
        async with pool.acquire() as conn:
            for sql in migrations:
                await conn.execute(sql)
        logger.info("✅ All column migrations applied successfully")
    except Exception as e:
        logger.warning(f"⚠️  Migration error (non-fatal): {e}")

    yield
    await pool.close()
    logger.info("Mechanics service: Database pool closed")

app = FastAPI(
    title="MOTOFIX - Mechanic Verification Service",
    version="2.0.0",
    description="Mechanics CRUD + auth for the MOTOFIX mechanic app",
    openapi_url="/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

# ────────────────────────────── CORS ──────────────────────────────
ALLOWED_ORIGINS = [
    "https://admin.motofix.org",
    "https://motofix-control-center.onrender.com",
    "https://motofix-mechanic-connect.onrender.com",
    "https://customer.motofix.org",
    "https://motofix-driver-assist.onrender.com",
    "https://motofix.org",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:8090",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
    "http://127.0.0.1:8085",
    "http://127.0.0.1:8090",
    "http://192.168.1.3:8090",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

# ────────────────────────────── HEALTH ──────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "motofix-mechanics-service",
        "database": "connected" if pool else "disconnected",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

# ────────────────────────────── ROUTERS ──────────────────────────────
app.include_router(auth_router.router)   # /auth/login, /auth/register, /auth/me
                                         # /mechanics/me/availability
                                         # /mechanics/me/location
                                         # /mechanics/me/current-job
app.include_router(mechanics.router)     # /mechanics/ CRUD (used by admin dashboard)