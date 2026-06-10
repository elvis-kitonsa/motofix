# app/main.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
from dotenv import load_dotenv

load_dotenv()

from app.routers import admin, auth, subscriptions
from app.db import init_db_pool, close_db_pool

logger = logging.getLogger(__name__)

app = FastAPI(
    title="MOTOFIX - Analytics and Reporting Service",
    description="Private admin endpoint – only accessible to you",
    version="1.0.0"
)

# ─────────────── CORS CONFIGURATION ───────────────
# Parse additional origins from environment variable (comma-separated)
env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Always include production and common dev URLs
allowed_origins = [
    "https://admin.motofix.org",                     # Admin dashboard (PRIMARY)
    "https://customer.motofix.org",                  # Customer app
    "https://motofix-control-center.onrender.com",   # Production frontend
    "https://motofix-driver-assist.onrender.com",    # Live driver app
    "https://motofixug.onrender.com",                # Alternative domain
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8087",
    "http://localhost:8088",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
    "http://192.168.1.3:8080",
    "http://192.168.1.3:5173",
    "http://192.168.1.3:3000",
    "http://192.168.1.3:8082",
    "http://192.168.1.3:8083",
    "http://192.168.1.3:8084",
] + env_origins

# Remove duplicates while preserving order
seen = set()
allowed_origins = [x for x in allowed_origins if not (x in seen or seen.add(x))]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────── INCLUDE ROUTERS ───────────────
app.include_router(auth.router)           # /api/login
app.include_router(admin.router)          # /admin/*
app.include_router(subscriptions.router)  # /subscriptions/*

# ─────────────── STARTUP / SHUTDOWN ───────────────
@app.on_event("startup")
async def on_startup():
    await init_db_pool(app)

@app.on_event("shutdown")
async def on_shutdown():
    await close_db_pool(app)

# ─────────────── HEALTH CHECKS ───────────────
@app.get("/health")
async def health_check():
    """Basic health check - works without database."""
    pool = getattr(app.state, "_db_pool", None)
    return {
        "status": "ok",
        "service": "admin-dashboard",
        "database": "connected" if pool else "disconnected"
    }

@app.get("/health-db")
async def health_check_db():
    """Database connectivity check."""
    try:
        pool = getattr(app.state, "_db_pool", None)
        if not pool:
            return {"status": "error", "database": "disconnected", "error": "No pool available"}
        
        # Test connection from pool
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check DB failed: {e}")
        return {"status": "error", "database": "disconnected", "error": str(e)}

# ─────────────── ROOT ───────────────
@app.get("/")
def root():
    return {"message": "Motofix Admin API – Protected. Welcome boss"}