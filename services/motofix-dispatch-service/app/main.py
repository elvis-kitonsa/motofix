# app/main.py

import os
import json
import asyncio
import tempfile
import uuid
import base64
import time
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, Request, Form, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from typing import List, Optional, Dict
from pydantic import BaseModel
import asyncpg
from contextlib import asynccontextmanager
import httpx
import logging
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from jose import jwt, JWTError
from app.storage import get_storage, StorageError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database pool
pool: Optional[asyncpg.Pool] = None
db_error: Optional[str] = None


async def run_migrations(db_pool: asyncpg.Pool):
    """Run idempotent startup migrations - creates tables if they don't exist."""
    logger.info("🔧 Running startup migrations...")
    async with db_pool.acquire() as conn:
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS service_requests (
                    id SERIAL PRIMARY KEY,
                    customer_name TEXT NOT NULL DEFAULT '',
                    service_type TEXT NOT NULL DEFAULT 'Other',
                    location TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)
            logger.info("✅ service_requests table ensured")

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS media_files (
                    id SERIAL PRIMARY KEY,
                    request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
                    file_url TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    file_name TEXT NOT NULL DEFAULT '',
                    size_kb FLOAT NOT NULL DEFAULT 0,
                    uploaded_at TIMESTAMP DEFAULT NOW()
                );
            """)
            logger.info("✅ media_files table ensured")

            # In-job chat: persisted so messages survive refresh and reach the
            # other party even if they were offline when it was sent.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    request_id INTEGER NOT NULL,
                    sender_role TEXT NOT NULL,            -- 'driver' | 'mechanic'
                    sender_id TEXT NOT NULL DEFAULT '',
                    body TEXT NOT NULL DEFAULT '',
                    media_type TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'voice' | 'image'
                    media_url TEXT NULL,
                    seen_by_driver BOOLEAN NOT NULL DEFAULT FALSE,
                    seen_by_mechanic BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON chat_messages(request_id)"
            )
            logger.info("✅ chat_messages table ensured")

            # Cancellation metadata — who cancelled and why.
            await conn.execute("ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS cancelled_by TEXT")
            await conn.execute("ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT")

            # Mechanic cancellation "strikes" — consecutive cancellations of jobs they
            # had already picked up. Reset to 0 whenever they complete a job. Three in
            # a row suspends them (a penalty to protect MOTOFIX's reputation).
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS mechanic_strikes (
                    mechanic_id INTEGER PRIMARY KEY,
                    strikes INTEGER NOT NULL DEFAULT 0,
                    suspended BOOLEAN NOT NULL DEFAULT FALSE,
                    suspended_at TIMESTAMP NULL,
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            """)
            logger.info("✅ cancellation columns + mechanic_strikes table ensured")

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS job_acceptances (
                    id SERIAL PRIMARY KEY,
                    request_id INTEGER UNIQUE NOT NULL,
                    mechanic_id INTEGER NOT NULL,
                    mechanic_name TEXT NOT NULL,
                    accepted_at TIMESTAMP DEFAULT NOW(),
                    eta_minutes INTEGER NULL
                );
            """)
            logger.info("✅ job_acceptances table ensured")

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    request_id INTEGER REFERENCES service_requests(id),
                    mechanic_id INTEGER,
                    driver_phone VARCHAR,
                    mechanic_phone VARCHAR,
                    quoted_amount INTEGER,
                    commission INTEGER DEFAULT 10000,
                    mechanic_payout INTEGER,
                    quote_approved BOOLEAN DEFAULT FALSE,
                    collection_reference VARCHAR,
                    disbursement_reference VARCHAR,
                    collection_status VARCHAR DEFAULT 'pending',
                    disbursement_status VARCHAR DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)
            logger.info("✅ payments table ensured")

            await conn.execute("""
                ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'mtn';
            """)
            logger.info("✅ payments.provider column ensured")

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS feature_flags (
                    key TEXT PRIMARY KEY,
                    enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    description TEXT,
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            """)
            logger.info("✅ feature_flags table ensured")

            # Seed variant-specific defaults so both `main` and `fyp` can share one DB.
            # Render should set `SERVICE_VARIANT=main` or `SERVICE_VARIANT=fyp`.
            await conn.execute("""
                INSERT INTO feature_flags (key, enabled, description)
                VALUES ('payments_main', FALSE, 'Payments disabled in main')
                ON CONFLICT (key) DO NOTHING
            """)
            await conn.execute("""
                INSERT INTO feature_flags (key, enabled, description)
                VALUES ('payments_fyp', TRUE, 'Payments enabled in fyp')
                ON CONFLICT (key) DO NOTHING
            """)

            # Add user_id and mechanic_id columns to service_requests if missing
            # Note: no cross-DB FK references (microservices — each service owns its own DB)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS user_id INTEGER
            """)
            logger.info("✅ service_requests.user_id column ensured")

            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS mechanic_id INTEGER
            """)
            logger.info("✅ service_requests.mechanic_id column ensured")

            # Job lifecycle timestamps (analytics + tracking)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL
            """)
            # ETA (minutes) the mechanic estimated when starting the journey — used to
            # show a shared arrival-time window on both the driver and mechanic apps.
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS eta_minutes INTEGER NULL
            """)
            # Completion handshake: when awaiting_confirmation started + who initiated it
            # ('mechanic' or 'driver'). The OTHER party confirms; a background task
            # auto-completes if no-one confirms within the grace period.
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS awaiting_confirmation_at TIMESTAMP NULL
            """)
            await conn.execute("""
                ALTER TABLE service_requests
                ADD COLUMN IF NOT EXISTS completion_by VARCHAR(16) NULL
            """)
            logger.info("✅ service_requests lifecycle timestamp columns ensured")

            # Reviews and ratings table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id           SERIAL PRIMARY KEY,
                    request_id   INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
                    mechanic_id  INTEGER NOT NULL,
                    reviewer_id  INTEGER NOT NULL,
                    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    comment      TEXT DEFAULT '',
                    direction    VARCHAR NOT NULL DEFAULT 'driver_to_mechanic',
                    created_at   TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(request_id, direction)
                )
            """)
            # Migrate existing table: add direction column + swap unique constraint
            await conn.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS direction VARCHAR NOT NULL DEFAULT 'driver_to_mechanic'")
            await conn.execute("ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_request_id_key")
            await conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_req_dir ON reviews(request_id, direction)")
            logger.info("✅ reviews table ensured")

            # Spare parts dealer directory
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS spare_parts_dealers (
                    id          SERIAL PRIMARY KEY,
                    name        TEXT NOT NULL,
                    phone       TEXT NOT NULL,
                    address     TEXT NOT NULL DEFAULT '',
                    location    TEXT NOT NULL DEFAULT '',
                    latitude    DOUBLE PRECISION,
                    longitude   DOUBLE PRECISION,
                    specialty   TEXT NOT NULL DEFAULT '',
                    description TEXT NOT NULL DEFAULT '',
                    verified    BOOLEAN NOT NULL DEFAULT FALSE,
                    active      BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at  TIMESTAMPTZ DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("✅ spare_parts_dealers table ensured")

            # NOTE: Avoid destructive schema changes by default.
            # Dropping legacy tables can break another deployment that still needs the data.
            if os.getenv("ALLOW_DESTRUCTIVE_MIGRATIONS", "false").lower() in ("1", "true", "yes"):
                await conn.execute("DROP TABLE IF EXISTS requests CASCADE")
                logger.info("✅ Legacy requests table dropped (destructive mode)")

            logger.info("✅ All startup migrations completed")
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}", exc_info=True)


async def _completion_watchdog():
    """Server-side safety net so no job ever hangs because a phone is closed:
       • awaiting_confirmation for >30 min → auto-complete
       • service_started untouched for >6 h → start the completion handshake
    """
    while True:
        try:
            await asyncio.sleep(60)
            if not pool:
                continue
            async with pool.acquire() as conn:
                done = await conn.fetch("""
                    UPDATE service_requests
                    SET status='completed', completed_at=COALESCE(completed_at, NOW())
                    WHERE status='awaiting_confirmation'
                      AND awaiting_confirmation_at IS NOT NULL
                      AND awaiting_confirmation_at < NOW() - INTERVAL '30 minutes'
                    RETURNING id
                """)
                for r in done:
                    await manager.broadcast({
                        "type": "status_update", "job_id": r["id"],
                        "status": "completed", "auto": True,
                        "updated_at": datetime.utcnow().isoformat() + "Z",
                    })
                    logger.info("⏲ Auto-completed job %s — no confirmation within 30 min", r["id"])

                stale = await conn.fetch("""
                    UPDATE service_requests
                    SET status='awaiting_confirmation',
                        awaiting_confirmation_at=NOW(),
                        completion_by='system'
                    WHERE status='service_started'
                      AND service_started_at IS NOT NULL
                      AND service_started_at < NOW() - INTERVAL '6 hours'
                    RETURNING id
                """)
                for r in stale:
                    await manager.broadcast({
                        "type": "status_update", "job_id": r["id"],
                        "status": "awaiting_confirmation", "auto": True,
                        "updated_at": datetime.utcnow().isoformat() + "Z",
                    })
                    logger.info("⏲ Job %s in service >6h — moved to awaiting_confirmation", r["id"])
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("completion watchdog error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, db_error
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        db_error = "DATABASE_URL environment variable is not set"
        logger.error(f"❌ {db_error}")
        logger.warning("⚠️  Starting in degraded mode - DB operations will fail gracefully")
        yield
        return
    
    logger.info(f"🔗 Attempting to connect to database: {dsn[:50]}...")
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=2,
                max_size=10,
                command_timeout=10,
            )
            logger.info("✅ Database pool created successfully")
            db_error = None
            # Run startup migrations to ensure tables exist
            await run_migrations(pool)
            break
        except Exception as e:
            db_error = str(e)
            attempt_msg = f"Attempt {attempt + 1}/{max_retries}"
            if attempt < max_retries - 1:
                logger.warning(f"⚠️  DB connection failed ({attempt_msg}): {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"❌ DB connection failed ({attempt_msg}): {e}")
                logger.warning("⚠️  Starting in degraded mode - DB operations will fail gracefully")
    
    # Start the completion safety-net watchdog (only when the DB is up)
    watchdog = asyncio.create_task(_completion_watchdog()) if pool else None

    yield

    if watchdog:
        watchdog.cancel()
    if pool:
        await pool.close()
        logger.info("✅ Database pool closed")

app = FastAPI(
    title="MOTOFIX - Request and Dispatch Management Service",
    version="1.0.0",
    description="Core API for creating and managing breakdown service requests with media support",
    lifespan=lifespan
)

# ════════════════════════════════ CORS ════════════════════════════════
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://customer.motofix.org",
    "https://motofix-driver-assist.onrender.com",
    "https://motofixug.onrender.com",
    "https://admin.motofix.org",
    "https://motofix.org",
    "https://motofix-mechanic-connect.onrender.com",
    "https://motofix-admin-dashboard.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8087",
    "http://localhost:8090",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
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

# ────────────────────────────── REVERSE GEOCODING (GOOGLE MAPS PROXY) ──────────────────────────────

# In-memory geocode cache: key → (result_dict, expires_at)
_geocode_cache: dict = {}
_GEOCODE_TTL = 30  # seconds
_GEOCODE_KEY_PRECISION = 4  # ~11 m


def _geocode_cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, _GEOCODE_KEY_PRECISION)},{round(lon, _GEOCODE_KEY_PRECISION)}"


@app.get("/geocode/reverse")
async def reverse_geocode(lat: float, lon: float):
    cache_key = _geocode_cache_key(lat, lon)
    cached = _geocode_cache.get(cache_key)
    if cached and time.time() < cached[1]:
        return cached[0]

    api_key = os.getenv("GOOGLE_GEOCODING_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Geocoding API key not configured")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "latlng": f"{lat},{lon}",
                "key": api_key,
            },
            timeout=10,
        )
        data = response.json()

        if data.get("status") != "OK":
            raise HTTPException(status_code=502, detail=f"Geocoding failed: {data.get('status')}")

        results = data.get("results", [])
        if not results:
            raise HTTPException(status_code=404, detail="No address found for these coordinates")

        result = {
            "display_name": results[0].get("formatted_address", ""),
            "lat": lat,
            "lon": lon,
        }
        _geocode_cache[cache_key] = (result, time.time() + _GEOCODE_TTL)
        return result

# ────────────────────────────── HEALTH CHECK ENDPOINTS ──────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint - responds even if DB is down"""
    return {
        "status": "ok",
        "service": "motofix-dispatch-service",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": "connected" if pool else "disconnected"
    }


@app.get("/health-db")
async def health_check_db():
    """Database health check - returns 503 if DB is unavailable"""
    try:
        if not pool:
            raise HTTPException(status_code=503, detail="Database pool not initialized")
        
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        return {
            "status": "ok",
            "service": "motofix-dispatch-service",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database health check failed")

# ────────────────────────────── DEPENDENCIES ──────────────────────────────
async def get_db():
    """Get database connection, raises HTTPException if DB is unavailable"""
    if pool is None:
        logger.error(f"🔴 DB pool is None. Reason: {db_error or 'Unknown'}")
        raise HTTPException(
            status_code=503,
            detail=f"Database service unavailable: {db_error or 'Connection pool not initialized'}"
        )

    # Acquire connection — only this step is wrapped; query errors must propagate naturally
    try:
        conn = await pool.acquire()
    except Exception as e:
        logger.error(f"🔴 pool.acquire() failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database service temporarily unavailable. Please try again."
        )

    try:
        yield conn
    except Exception:
        raise
    finally:
        await pool.release(conn)

async def is_feature_enabled(db: asyncpg.Connection, feature_key: str, default: bool = False) -> bool:
    """
    Checks DB-backed feature flags.

    For safe shared-DB deployments, we support variant-specific keys:
      - if `SERVICE_VARIANT=fyp`, `payments` reads `payments_fyp` first
      - if that key doesn't exist, it falls back to `payments`
    """
    variant = os.getenv("SERVICE_VARIANT", "").strip()
    keys_to_try: list[str] = []

    if variant:
        keys_to_try.append(f"{feature_key}_{variant}")
    keys_to_try.append(feature_key)

    for key in keys_to_try:
        row = await db.fetchrow(
            "SELECT enabled FROM feature_flags WHERE key = $1",
            key,
        )
        if row is not None:
            return bool(row["enabled"])

    return default

# ═══════════════════════════════ FEATURE FLAGS ═══════════════════════════════
@app.get("/feature-flags")
async def feature_flags(db=Depends(get_db)):
    payments_enabled = await is_feature_enabled(db, "payments", default=False)
    return {
        "service_variant": os.getenv("SERVICE_VARIANT", None),
        "payments": payments_enabled,
    }

async def get_current_user(request: Request, db=Depends(get_db)) -> Dict:
    """
    Verify JWT token and return authenticated user.
    Reuses same JWT secret/algorithm as auth service.
    """
    token = None
    auth_header = request.headers.get("authorization")
    
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        logger.debug(f"✅ Bearer token found in Authorization header")
    else:
        token = request.cookies.get("access_token")
        if token:
            logger.debug(f"ℹ️ Using token from httpOnly cookie")
    
    if not token:
        logger.error("❌ No token found in request")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        logger.error("❌ SECRET_KEY environment variable not set")
        raise HTTPException(status_code=500, detail="Server configuration error")

    algorithm = os.getenv("ALGORITHM", "HS256")

    # Try mechanic secret first, then driver secret (motofix-auth-service may use a different key)
    driver_secret = os.getenv("DRIVER_SECRET_KEY", secret_key)
    secrets_to_try = list(dict.fromkeys([secret_key, driver_secret]))  # dedup, preserve order

    payload = None
    for secret in secrets_to_try:
        try:
            payload = jwt.decode(token, secret, algorithms=[algorithm])
            break
        except JWTError:
            continue

    try:
        if payload is None:
            raise JWTError("All secrets exhausted")
        user_id: str = payload.get("sub")
        user_role: str = payload.get("role", "driver")

        if not user_id:
            logger.error("❌ Token missing 'sub' claim")
            raise HTTPException(status_code=401, detail="Invalid token")

        logger.debug(f"✅ Token decoded successfully for user_id: {user_id}, role: {user_role}")

        # Route to the correct table based on role claim in the JWT.
        # Querying users first then mechanics is wrong: IDs overlap across tables.
        # Phone may be baked into the JWT claim (preferred) or looked up from the DB
        jwt_phone: str | None = payload.get("phone")

        if user_role == "mechanic":
            try:
                mech_row = await db.fetchrow(
                    "SELECT id, phone FROM mechanics WHERE id = $1", int(user_id)
                )
                if mech_row:
                    return {"id": mech_row["id"], "role": "mechanic", "phone": mech_row["phone"]}
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch from mechanics table: {e}")
            return {"id": int(user_id), "role": "mechanic", "phone": jwt_phone}
        else:
            # Use JWT phone if present — avoids dependency on a users table in this DB
            if jwt_phone:
                return {"id": int(user_id), "role": user_role, "phone": jwt_phone}
            try:
                user_row = await db.fetchrow(
                    "SELECT id, phone, full_name, role FROM users WHERE id = $1", int(user_id)
                )
                if user_row:
                    return dict(user_row)
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch from users table: {e}")
            return {"id": int(user_id), "role": user_role, "phone": None}
        
    except JWTError as e:
        logger.error(f"❌ JWT decode failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

# ────────────────────────────── MODELS ──────────────────────────────
class MediaFile(BaseModel):
    url: str
    file_type: str  # "voice", "photo", "document"
    size_kb: float
    uploaded_at: str

class RequestCreate(BaseModel):
    customer_name: str = ""
    service_type: str = "Other"
    location: str = ""
    description: str = ""
    phone: str = ""

class RequestOut(BaseModel):
    id: str
    customer_name: str
    service_type: str
    location: str
    description: str
    # phone field EXCLUDED - never returned in normal responses
    status: str = "pending"
    media_files: Optional[List[MediaFile]] = None
    created_at: Optional[str] = None
    user_id: Optional[int] = None
    mechanic_id: Optional[int] = None
    dispatched_at: Optional[str] = None
    accepted_at: Optional[str] = None
    en_route_at: Optional[str] = None
    arrived_at: Optional[str] = None
    service_started_at: Optional[str] = None
    completed_at: Optional[str] = None

class CallPartnerResponse(BaseModel):
    phone: str  # Only returned from secure /call-partner endpoint

# ────────────────────────────── ENDPOINTS ──────────────────────────────

# ────────────────────────────── WebSocket / Real-time support ──────────────────────────────
from datetime import timedelta
from typing import Dict, Any

class ConnectionManager:
    """Simple WebSocket connection manager for broadcasting events to all connected clients."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🔌 WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass
        logger.info(f"❎ WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        # Send JSON message to all active clients, cleaning up dead sockets
        disconnected = []
        for ws in list(self.active_connections):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)

manager = ConnectionManager()


# ── Matching-service helpers ──────────────────────────────────────────────────

def _parse_latlong(location: str):
    """Return (lat, lng) floats if location is 'lat,lng', else None."""
    parts = location.split(",", 1)
    if len(parts) == 2:
        try:
            lat, lng = float(parts[0].strip()), float(parts[1].strip())
            if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat != 0 or lng != 0):
                return lat, lng
        except ValueError:
            pass
    return None


def _service_token() -> str:
    """Create a short-lived JWT for service-to-service calls (same SECRET_KEY)."""
    from datetime import timezone, timedelta
    secret = os.getenv("SECRET_KEY", "")
    algo   = os.getenv("ALGORITHM", "HS256")
    exp    = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": "dispatch-service", "role": "service", "exp": exp}, secret, algorithm=algo)


async def _dispatch_to_matched_mechanics(
    request_id: int,
    location: str,
    service_type: str,
    notifications_url: str,
    job_data: dict,
) -> None:
    """
    Background task: call the matching service, get top-ranked mechanics,
    and send targeted FCM push to each one that has a registered FCM token.
    Falls back gracefully on any error — never blocks the main response.
    """
    coords = _parse_latlong(location)
    if not coords:
        logger.debug("Matching skipped for request %s — location not parseable as lat,lng", request_id)
        return

    lat, lng = coords
    matching_url = os.getenv("MATCHING_SERVICE_URL", "http://localhost:8003")

    try:
        token = _service_token()
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{matching_url}/match",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "request_id": request_id,
                    "latitude": lat,
                    "longitude": lng,
                    "service_type": service_type,
                    "top_n": 10,
                },
            )
            resp.raise_for_status()
            candidates = resp.json().get("candidates", [])
    except Exception as exc:
        logger.warning("Matching service unreachable for request %s: %s", request_id, exc)
        return

    mechanic_tokens = [c["fcm_token"] for c in candidates if c.get("fcm_token")]
    if not mechanic_tokens:
        logger.debug("No FCM tokens in matching response for request %s", request_id)
        return

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{notifications_url}/notify/push/bulk",
                json={
                    "device_tokens": mechanic_tokens,
                    "title": "New Job Available",
                    "body": f"{service_type} — {location[:60]}",
                    "data": {
                        "request_id": str(request_id),
                        "type": "new_job",
                        "service_type": service_type,
                    },
                },
            )
        logger.info(
            "FCM push sent to %d matched mechanics for request %s",
            len(mechanic_tokens), request_id,
        )
    except Exception as exc:
        logger.warning("FCM bulk push failed for request %s: %s", request_id, exc)


@app.websocket("/ws/jobs")
async def jobs_ws(websocket: WebSocket):
    """WebSocket endpoint for real-time job events and in-job chat.
    Broadcasts: 'new_job', 'job_taken', 'status_update', 'chat_message', 'location_update', 'price_quote', 'quote_approved'.
    Clients send JSON; relayed message types are forwarded to all connected clients.
    """
    _RELAY_TYPES = {"chat_message", "chat_typing", "chat_seen", "location_update", "price_quote", "quote_approved"}
    await manager.connect(websocket)
    try:
        while True:
            try:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                    if msg.get("type") in _RELAY_TYPES:
                        await manager.broadcast(msg)
                except (json.JSONDecodeError, AttributeError):
                    pass  # plain-text pings — ignore
            except WebSocketDisconnect:
                break
            except Exception:
                await asyncio.sleep(0.1)
    finally:
        manager.disconnect(websocket)


# Helper: ensure job_acceptances table exists (safe to call idempotently)
async def ensure_acceptances_table(db: asyncpg.Connection):
    try:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS job_acceptances (
                id SERIAL PRIMARY KEY,
                request_id INTEGER UNIQUE NOT NULL,
                mechanic_id INTEGER NOT NULL,
                mechanic_name TEXT NOT NULL,
                accepted_at TIMESTAMP DEFAULT NOW(),
                eta_minutes INTEGER NULL
            );
            """
        )
        logger.info("✅ job_acceptances table ensured")
    except Exception as e:
        logger.error(f"Failed to ensure job_acceptances table: {e}")

# ────────────────────────────── ENDPOINTS ──────────────────────────────

@app.post("/requests/", response_model=RequestOut)
async def create_request(
    payload: RequestCreate,
    background_tasks: BackgroundTasks,
    user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Create request with JSON payload (text only, no media).
    For media files, use the FormData endpoint.
    """
    print("📥 /requests hit")
    logger.info("🟢 POST /requests/ hit")
    try:
        customer_name = (payload.customer_name or "").strip() or "Driver"
        service_type = (payload.service_type or "").strip() or "Other"
        location = (payload.location or "").strip()
        description = (payload.description or "").strip()
        # Always bind request to authenticated driver
        if user.get("role") not in ("driver", "admin"):
            raise HTTPException(status_code=403, detail="Only drivers can create requests")
        phone = (user.get("phone") or "").strip()
        if not location:
            raise HTTPException(status_code=400, detail="location is required")
        if not phone:
            raise HTTPException(status_code=400, detail="phone is required")
        logger.info(f"   Payload received: customer_name={customer_name}, service_type={service_type}, phone={phone}")
        
        logger.info("📝 Before database insertion")
        query = """
            INSERT INTO service_requests 
            (customer_name, service_type, location, description, phone, status, user_id, dispatched_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
            RETURNING id, customer_name, service_type, location, description, phone, status, created_at, user_id, mechanic_id,
                      dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
        """
        try:
            result = await db.fetchrow(
                query,
                customer_name,
                service_type,
                location,
                description,
                phone,
                int(user.get("id")) if user.get("id") is not None else None,
            )
        except Exception as e:
            logger.error(f"❌ Database INSERT failed: {type(e).__name__}: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        if not result:
            logger.error("❌ Database returned no result after INSERT")
            raise HTTPException(status_code=500, detail="Failed to create request")
        
        request_data = dict(result)
        request_data['id'] = str(request_data['id'])
        if request_data.get('created_at'):
            request_data['created_at'] = request_data['created_at'].isoformat()
        for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
            if request_data.get(k):
                request_data[k] = request_data[k].isoformat()
        request_data['media_files'] = []  # No media files for JSON-only requests
        # Remove phone from response (never expose in normal API responses)
        request_data.pop('phone', None)
        
        logger.info(f"✅ Request created successfully: id={request_data['id']}")
        # Broadcast new job event to WebSocket clients (expires in 5 minutes)
        try:
            expires_at = datetime.utcnow() + timedelta(minutes=5)
            await manager.broadcast({
                'type': 'new_job',
                'job': request_data,
                'expires_at': expires_at.isoformat() + 'Z',
            })
        except Exception as e:
            logger.warning(f"Failed to broadcast new_job event: {e}")

        # FCM push to matched mechanics via matching service (best-effort, non-blocking)
        notifications_url = os.getenv("NOTIFICATIONS_URL", "http://localhost:8004")
        background_tasks.add_task(
            _dispatch_to_matched_mechanics,
            int(request_data['id']),
            location,
            service_type,
            notifications_url,
            request_data,
        )

        return request_data
        
    except HTTPException:
        # Re-raise HTTP exceptions (400, 500, etc.)
        raise
    except Exception as e:
        logger.error(f"❌ Exception in POST /requests/: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Request creation failed: {str(e)}")


def _get_file_type(file: UploadFile) -> str:
    mime_type = (file.content_type or "").lower()
    fn = (file.filename or "").lower()
    if mime_type.startswith("audio/") or fn.endswith(".webm"):
        return "voice"
    if mime_type.startswith("image/"):
        return "photo"
    return "document"


async def _upload_media_background(
    request_id: int,
    files_info: list[tuple[str, str, str]],
) -> None:
    """Background task: upload files to storage and insert media records. Runs after response is sent."""
    if not pool or not files_info:
        return
    try:
        storage = get_storage()
    except Exception as e:
        logger.error(f"❌ Background upload: storage init failed: {e}")
        return
    async with pool.acquire() as db:
        for temp_path, filename, file_type in files_info:
            try:
                media_info = await storage.upload_file(temp_path, file_type, str(request_id))
                await db.execute(
                    """
                    INSERT INTO media_files
                    (request_id, file_url, file_type, file_name, size_kb, uploaded_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    request_id,
                    media_info["url"],
                    media_info["file_type"],
                    filename,
                    media_info["size_kb"],
                    media_info["uploaded_at"],
                )
                logger.info(f"✅ Background upload: {filename} ({media_info['size_kb']} KB)")
            except Exception as e:
                logger.error(f"❌ Background upload failed for {filename}: {e}")
            finally:
                Path(temp_path).unlink(missing_ok=True)


@app.post("/requests-with-media/", response_model=RequestOut)
async def create_request_with_media(
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user),
    customer_name: str = Form(...),
    service_type: str = Form(...),
    location: str = Form(...),
    description: str = Form(...),
    media_files: Optional[List[UploadFile]] = File(default=None),
    db=Depends(get_db),
):
    """
    Create request with media files using FormData.
    Responds immediately after DB insert; file uploads run in background.
    """
    file_list = media_files or []
    print("📥 /requests-with-media hit, files:", len(file_list))
    logger.info(f"📤 Creating request with media for customer: {customer_name}, files: {len(file_list)}")
    
    customer_name = (customer_name or "").strip() or "Driver"
    service_type = (service_type or "").strip() or "Other"
    location = (location or "").strip()
    description = (description or "").strip()
    if current_user.get("role") not in ("driver", "admin"):
        raise HTTPException(status_code=403, detail="Only drivers can create requests")
    phone = (current_user.get("phone") or "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="location is required")
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")
    
    query = """
        INSERT INTO service_requests 
        (customer_name, service_type, location, description, phone, status, user_id, dispatched_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
        RETURNING id, customer_name, service_type, location, description, phone, status, created_at, user_id, mechanic_id,
                  dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
    """
    result = await db.fetchrow(
        query,
        customer_name,
        service_type,
        location,
        description,
        phone,
        int(current_user.get("id")) if current_user.get("id") is not None else None,
    )
    
    if not result:
        logger.error("Failed to insert request")
        raise HTTPException(status_code=500, detail="Failed to create request")
    
    request_id = result["id"]
    request_data = dict(result)
    request_data["id"] = str(request_id)
    request_data.pop("phone", None)
    if request_data.get('created_at'):
        request_data['created_at'] = request_data['created_at'].isoformat()
    for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
        if request_data.get(k):
            request_data[k] = request_data[k].isoformat()
    request_data["media_files"] = []
    
    # Save uploaded files to temp files and run uploads in background (non-blocking)
    if file_list:
        files_info: list[tuple[str, str, str]] = []
        for file in file_list:
            if not file.filename:
                continue
            try:
                contents = await file.read()
                with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                    tmp.write(contents)
                    tmp.flush()
                    files_info.append((tmp.name, file.filename, _get_file_type(file)))
            except Exception as e:
                logger.warning(f"Failed to read file {file.filename}: {e}")
        if files_info:
            background_tasks.add_task(_upload_media_background, request_id, files_info)
    
    logger.info(f"✅ Request created: id={request_id}, media will upload in background")

    # Broadcast new job event to WebSocket clients
    try:
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        await manager.broadcast({
            'type': 'new_job',
            'job': request_data,
            'expires_at': expires_at.isoformat() + 'Z',
        })
    except Exception as e:
        logger.warning(f"Failed to broadcast new_job event: {e}")

    # FCM push to matched mechanics via matching service (best-effort, non-blocking)
    notifications_url_m = os.getenv("NOTIFICATIONS_URL", "http://localhost:8004")
    background_tasks.add_task(
        _dispatch_to_matched_mechanics,
        request_id,
        location,
        service_type,
        notifications_url_m,
        request_data,
    )

    return request_data

@app.get("/requests/", response_model=List[RequestOut])
async def get_requests(
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get request history.
    - driver: only own requests
    - admin: all requests, with optional status and search filters
    """
    try:
        role = (current_user.get("role") or "driver").lower()
        user_id = current_user.get("id")
        user_phone = current_user.get("phone")

        if role not in ("driver", "admin", "mechanic"):
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Normalise status: frontend sends 'in_progress' but DB uses multi-value statuses
        status_filter: Optional[list] = None
        if status and status != "all":
            if status == "in_progress":
                status_filter = ["en_route", "arrived", "service_started"]
            else:
                status_filter = [status]

        query = """
            SELECT id, customer_name, service_type, location, description, phone, status, created_at,
                   user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
            FROM service_requests
            WHERE
                (
                    ($1::text = 'admin')
                    OR (
                        $1::text = 'driver'
                        AND (
                            (user_id IS NOT NULL AND user_id = $2)
                            OR ($3::text IS NOT NULL AND phone = $3)
                        )
                    )
                )
                AND ($4::text[] IS NULL OR status = ANY($4::text[]))
                AND ($5::text IS NULL OR
                     customer_name ILIKE '%' || $5 || '%' OR
                     service_type ILIKE '%' || $5 || '%' OR
                     location ILIKE '%' || $5 || '%')
            ORDER BY created_at DESC
        """
        rows = await db.fetch(
            query,
            role,
            int(user_id) if user_id is not None else None,
            user_phone,
            status_filter,
            search if search else None,
        )
        
        requests_list = []
        for row in rows:
            request_data = dict(row)
            request_data["id"] = str(request_data["id"])
            request_data.pop("phone", None)
            if request_data.get("created_at"):
                request_data["created_at"] = request_data["created_at"].isoformat()
            for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
                if request_data.get(k):
                    request_data[k] = request_data[k].isoformat()
            request_data["media_files"] = []
            try:
                media_query = """
                    SELECT file_url as url, file_type, size_kb, uploaded_at
                    FROM media_files
                    WHERE request_id = $1
                    ORDER BY uploaded_at DESC
                """
                media_rows = await db.fetch(media_query, row["id"])
                request_data["media_files"] = [dict(m) for m in media_rows] if media_rows else []
            except Exception as me:
                logger.warning(f"Could not fetch media for request {row.get('id')}: {me}")
            
            requests_list.append(request_data)
        
        logger.info(f"📊 Fetched {len(requests_list)} requests")
        return requests_list
    except Exception as e:
        logger.error(f"❌ Failed to fetch requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch requests: {str(e)}")


@app.get("/requests/pending", response_model=List[RequestOut])
async def get_pending_requests(current_user: Dict = Depends(get_current_user), db=Depends(get_db)):
    """Return all pending, unassigned requests so mechanics can browse available jobs."""
    role = (current_user.get("role") or "").lower()
    if role not in ("mechanic", "admin"):
        raise HTTPException(status_code=403, detail="Only mechanics can view pending requests")
    try:
        rows = await db.fetch("""
            SELECT id, customer_name, service_type, location, description, status, created_at,
                   user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at,
                   service_started_at, completed_at, eta_minutes, completion_by
            FROM service_requests
            WHERE status = 'pending' AND mechanic_id IS NULL
            ORDER BY created_at DESC
            LIMIT 50
        """)
        results = []
        for row in rows:
            data = dict(row)
            data["id"] = str(data["id"])
            data.pop("phone", None)
            if data.get("created_at"):
                data["created_at"] = data["created_at"].isoformat()
            for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
                if data.get(k):
                    data[k] = data[k].isoformat()
            data["media_files"] = []
            results.append(data)
        return results
    except Exception as e:
        logger.error(f"❌ Failed to fetch pending requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch pending requests: {str(e)}")


@app.get("/requests/{request_id}", response_model=RequestOut)
async def get_request(request_id: int, current_user: Dict = Depends(get_current_user), db=Depends(get_db)):
    """Get single request with media files"""
    query = """
        SELECT id, customer_name, service_type, location, description, phone, status, created_at,
               user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
        FROM service_requests
        WHERE id = $1
    """
    result = await db.fetchrow(query, request_id)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")

    role = (current_user.get("role") or "driver").lower()
    if role not in ("driver", "admin", "mechanic"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # driver can only view own request (by user_id if present, else phone)
    if role == "driver":
        uid = current_user.get("id")
        phone = current_user.get("phone")
        if (result.get("user_id") is not None and uid is not None and int(result["user_id"]) != int(uid)) and (
            not phone or result.get("phone") != phone
        ):
            raise HTTPException(status_code=403, detail="Not allowed")
    
    request_data = dict(result)
    request_data['id'] = str(request_data['id'])
    # Remove phone from response (never expose in normal API responses)
    request_data.pop('phone', None)
    if request_data.get('created_at'):
        request_data['created_at'] = request_data['created_at'].isoformat()
    for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
        if request_data.get(k):
            request_data[k] = request_data[k].isoformat()
    
    # Fetch media files
    media_query = """
        SELECT file_url as url, file_type, size_kb, uploaded_at
        FROM media_files
        WHERE request_id = $1
        ORDER BY uploaded_at DESC
    """
    media_rows = await db.fetch(media_query, request_id)
    request_data['media_files'] = [dict(m) for m in media_rows] if media_rows else []
    
    return request_data


@app.get("/requests/{request_id}/call-partner", response_model=CallPartnerResponse)
async def get_call_partner_phone(
    request_id: int,
    request: Request,
    db=Depends(get_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Secure endpoint to get the other party's phone number for calling.
    
    Rules:
    - Only works when job status is 'accepted' or 'en_route'
    - Only accessible to the driver (owner of the request) or assigned mechanic
    - Never exposes phone numbers in normal API responses - only this dedicated endpoint
    - Returns phone number which frontend uses to trigger tel: link (never displayed in UI)
    """
    logger.info(f"📞 Call partner request for request_id={request_id} by user_id={current_user.get('id')}")
    
    # 1. Load the service request
    query = """
        SELECT id, phone, status, customer_name
        FROM service_requests
        WHERE id = $1
    """
    request_row = await db.fetchrow(query, request_id)
    
    if not request_row:
        logger.warning(f"❌ Request {request_id} not found")
        raise HTTPException(status_code=404, detail="Request not found")
    
    request_status = request_row['status']
    driver_phone = request_row['phone']
    
    # 2. Check status - only allow calling during active job
    # Accept both "en_route" (backend) and "on_the_way" (frontend) as valid statuses
    if request_status not in ("accepted", "en_route", "on_the_way"):
        logger.warning(f"❌ Request {request_id} status is '{request_status}', not active")
        raise HTTPException(
            status_code=403,
            detail="Calling is only allowed for active jobs (accepted or en_route)"
        )
    
    # 3. Check if user is the driver (match phone from token with request phone)
    user_phone = current_user.get('phone')
    is_driver = user_phone and user_phone == driver_phone
    
    # 4. Check if user is the assigned mechanic (via job_acceptances table)
    is_mechanic = False
    mechanic_id = None
    if current_user.get('role') == 'mechanic':
        try:
            await ensure_acceptances_table(db)
            acceptance_query = """
                SELECT mechanic_id
                FROM job_acceptances
                WHERE request_id = $1
            """
            acceptance_row = await db.fetchrow(acceptance_query, request_id)
            if acceptance_row:
                mechanic_id = acceptance_row['mechanic_id']
                # Verify the mechanic_id matches current user's id
                if current_user.get('id') == mechanic_id:
                    is_mechanic = True
        except Exception as e:
            logger.warning(f"⚠️ Could not check mechanic assignment: {e}")
    
    # 5. Authorization check
    if not (is_driver or is_mechanic):
        logger.warning(f"❌ User {current_user.get('id')} not authorized to call for request {request_id}")
        raise HTTPException(
            status_code=403,
            detail="Not authorized to call for this request"
        )
    
    # 6. Determine which phone to return
    if is_driver:
        # Driver is calling mechanic - get mechanic phone from mechanics table
        if not mechanic_id:
            # Get mechanic_id from job_acceptances
            try:
                await ensure_acceptances_table(db)
                acceptance_query = """
                    SELECT mechanic_id
                    FROM job_acceptances
                    WHERE request_id = $1
                """
                acceptance_row = await db.fetchrow(acceptance_query, request_id)
                if not acceptance_row:
                    raise HTTPException(
                        status_code=400,
                        detail="No mechanic assigned to this request yet"
                    )
                mechanic_id = acceptance_row['mechanic_id']
            except Exception as e:
                logger.error(f"❌ Failed to get mechanic_id: {e}")
                raise HTTPException(
                    status_code=400,
                    detail="No mechanic assigned to this request yet"
                )
        
        # Fetch mechanic phone from mechanics table
        try:
            mechanic_query = """
                SELECT phone
                FROM mechanics
                WHERE id = $1
            """
            mechanic_row = await db.fetchrow(mechanic_query, mechanic_id)
            if not mechanic_row or not mechanic_row.get('phone'):
                raise HTTPException(
                    status_code=400,
                    detail="Mechanic phone not available"
                )
            partner_phone = mechanic_row['phone']
            logger.info(f"✅ Returning mechanic phone for request {request_id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to fetch mechanic phone: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve mechanic phone"
            )
    else:
        # Mechanic is calling driver - return driver phone from service_requests
        partner_phone = driver_phone
        logger.info(f"✅ Returning driver phone for request {request_id}")
    
    if not partner_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number not available"
        )
    
    # 7. Return ONLY the phone field (never logged or displayed in UI)
    return CallPartnerResponse(phone=partner_phone)


class AcceptPayload(BaseModel):
    eta_minutes: Optional[int] = 15


@app.patch("/requests/{request_id}/accept")
async def accept_request(
    request_id: int,
    payload: AcceptPayload,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Mechanic attempts to accept a job. First acceptor wins (atomic update).
    Returns 409 if the job is already taken.
    """
    # Ensure acceptance tracking table exists (idempotent)
    await ensure_acceptances_table(db)

    try:
        if (current_user.get("role") or "").lower() != "mechanic":
            raise HTTPException(status_code=403, detail="Only mechanics can accept jobs")

        mechanic_id = int(current_user.get("id"))
        mechanic_name = current_user.get("name") or current_user.get("full_name") or "Mechanic"

        # Suspended mechanics (3 consecutive pick-up cancellations) can't take new jobs.
        strike_state = await _get_strike_row(db, mechanic_id)
        if strike_state.get("suspended"):
            raise HTTPException(
                status_code=403,
                detail="Your account is suspended for repeatedly cancelling jobs. Contact MOTOFIX support.",
            )

        async with db.transaction():
            # Try to change the status atomically only if it's still pending
            result = await db.fetchrow(
                """
                UPDATE service_requests
                SET status = 'accepted',
                    mechanic_id = $2,
                    accepted_at = COALESCE(accepted_at, NOW())
                WHERE id = $1 AND status = 'pending' AND mechanic_id IS NULL
                RETURNING id, customer_name, service_type, location, description, phone, status, created_at,
                          user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
                """,
                request_id,
                mechanic_id,
            )

            if not result:
                existing = await db.fetchrow("SELECT status FROM service_requests WHERE id = $1", request_id)
                if existing:
                    status = existing.get('status')
                    raise HTTPException(status_code=409, detail=f"Job already {status}")
                raise HTTPException(status_code=404, detail="Request not found")

            # Record acceptance details
            await db.execute(
                "INSERT INTO job_acceptances (request_id, mechanic_id, mechanic_name, eta_minutes) VALUES ($1,$2,$3,$4)",
                request_id, mechanic_id, mechanic_name, payload.eta_minutes,
            )

            # Increment mechanic's jobs_completed as a lightweight leaderboard stub (if mechanic exists)
            # Wrapped in nested transaction (SAVEPOINT) so a failure here does NOT abort the outer transaction.
            # Without this, a failed UPDATE (e.g. mechanics table missing) leaves PostgreSQL in an error state
            # and the subsequent COMMIT fails, causing a 500.
            try:
                async with db.transaction():
                    await db.execute("UPDATE mechanics SET jobs_completed = COALESCE(jobs_completed,0) + 1 WHERE id = $1", mechanic_id)
            except Exception:
                logger.debug("Failed to increment mechanic's jobs_completed (non-critical)")

            # Build response and broadcast the event
            request_data = dict(result)
            request_data['id'] = str(request_data['id'])
            if request_data.get('created_at'):
                request_data['created_at'] = request_data['created_at'].isoformat()
            for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
                if request_data.get(k):
                    request_data[k] = request_data[k].isoformat()
            request_data['media_files'] = []

            event = {
                'type': 'job_taken',
                'job_id': request_id,
                'mechanic': {
                    'id': mechanic_id,
                    'name': mechanic_name,
                },
                'eta_minutes': payload.eta_minutes,
                'taken_at': datetime.utcnow().isoformat() + 'Z',
            }

            # Broadcast to all connected WebSocket clients
            await manager.broadcast(event)

            # Also broadcast a status update with the canonical request snapshot
            await manager.broadcast({
                'type': 'status_update',
                'job_id': request_id,
                'status': 'accepted',
                'request': {k: v for k, v in request_data.items() if k != 'phone'},
                'updated_at': datetime.utcnow().isoformat() + 'Z',
            })

            return JSONResponse({'status': 'accepted', 'request_id': str(request_id), 'mechanic': event['mechanic'], 'eta_minutes': payload.eta_minutes})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Exception in PATCH /requests/{{request_id}}/accept: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to accept job")

@app.post("/requests/{request_id}/reject")
async def reject_request(request_id: int, db=Depends(get_db)):
    """Mechanic rejects a pending job.
    The job stays 'pending' in the DB so another mechanic can still accept it.
    Re-broadcasts new_job so mechanics currently online get another chance.
    Returns 200 even if the job no longer exists or is already taken (mechanic's local state handles it).
    """
    row = await db.fetchrow(
        "SELECT id, customer_name, service_type, location, description, status, created_at "
        "FROM service_requests WHERE id = $1 AND status = 'pending'",
        request_id,
    )

    if not row:
        # Already accepted or doesn't exist — mechanic's UI will dismiss locally anyway
        return JSONResponse({'status': 'ok', 'request_id': request_id})

    request_data = dict(row)
    request_data['id'] = str(request_data['id'])
    if request_data.get('created_at'):
        request_data['created_at'] = request_data['created_at'].isoformat()
    request_data['media_files'] = []

    # Re-broadcast so other mechanics who are online now get another chance
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    try:
        await manager.broadcast({
            'type': 'new_job',
            'job': request_data,
            'expires_at': expires_at.isoformat() + 'Z',
        })
    except Exception as e:
        logger.warning(f"Failed to re-broadcast after rejection of request {request_id}: {e}")

    logger.info(f"🚫 Request {request_id} rejected — re-broadcast to {len(manager.active_connections)} clients")
    return JSONResponse({'status': 'ok', 'request_id': request_id})


@app.post("/requests/{request_id}/redispatch")
async def redispatch_request(
    request_id: int,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Driver re-dispatches an existing pending request (e.g. no providers found).
    Resets dispatched_at to NOW() and re-broadcasts new_job so mechanics get another chance.
    """
    role = (current_user.get("role") or "driver").lower()
    user_id = current_user.get("id")
    user_phone = current_user.get("phone")

    row = await db.fetchrow(
        "SELECT id, status, user_id, phone FROM service_requests WHERE id = $1",
        request_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    if row["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot redispatch a cancelled request")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot redispatch a request with status '{row['status']}'")

    if role == "driver":
        owns = (
            (row.get("user_id") is not None and user_id is not None and int(row["user_id"]) == int(user_id))
            or (user_phone and row.get("phone") == user_phone)
        )
        if not owns:
            raise HTTPException(status_code=403, detail="Not allowed")

    result = await db.fetchrow(
        """
        UPDATE service_requests
        SET dispatched_at = NOW()
        WHERE id = $1
        RETURNING id, customer_name, service_type, location, description, status, created_at,
                  user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
        """,
        request_id,
    )

    request_data = dict(result)
    request_data["id"] = str(request_data["id"])
    request_data.pop("phone", None)
    if request_data.get("created_at"):
        request_data["created_at"] = request_data["created_at"].isoformat()
    for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
        if request_data.get(k):
            request_data[k] = request_data[k].isoformat()
    request_data["media_files"] = []

    expires_at = datetime.utcnow() + timedelta(minutes=5)
    try:
        await manager.broadcast({
            "type": "new_job",
            "job": request_data,
            "expires_at": expires_at.isoformat() + "Z",
        })
    except Exception as e:
        logger.warning(f"Failed to broadcast new_job on redispatch for request {request_id}: {e}")

    logger.info(f"🔁 Request {request_id} re-dispatched — broadcast to {len(manager.active_connections)} clients")
    return JSONResponse({"status": "redispatched", "request": request_data})


@app.get("/mechanics/{mechanic_id}/current-job")
async def get_mechanic_current_job(mechanic_id: int, db=Depends(get_db)):
    """Return the active (non-completed, non-cancelled) job assigned to a mechanic.
    Used internally by the verification service as a proxy endpoint.
    """
    try:
        row = await db.fetchrow(
            """
            SELECT ja.request_id AS id, ja.accepted_at, ja.eta_minutes,
                   sr.customer_name, sr.service_type, sr.location,
                   sr.description, sr.status,
                   sr.mechanic_id, sr.user_id, sr.created_at,
                   sr.en_route_at, sr.arrived_at, sr.service_started_at, sr.completed_at
            FROM job_acceptances ja
            JOIN service_requests sr ON sr.id = ja.request_id
            WHERE ja.mechanic_id = $1
              AND sr.status NOT IN ('completed', 'cancelled')
            ORDER BY ja.accepted_at DESC
            LIMIT 1
            """,
            mechanic_id,
        )
    except Exception as e:
        logger.warning(f"current-job query failed for mechanic {mechanic_id}: {e}")
        return {"job": None}

    if not row:
        return {"job": None}

    job = dict(row)
    job["id"] = str(job["id"])
    for ts in ("accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at", "created_at"):
        if job.get(ts):
            job[ts] = job[ts].isoformat()
    return {"job": job}


# ─────────────────────── MECHANIC CANCELLATION STRIKES ───────────────────────
STRIKE_LIMIT = 3  # consecutive pick-up cancellations before suspension

async def _get_strike_row(db, mechanic_id: int) -> dict:
    row = await db.fetchrow(
        "SELECT mechanic_id, strikes, suspended FROM mechanic_strikes WHERE mechanic_id = $1",
        mechanic_id,
    )
    return dict(row) if row else {"mechanic_id": mechanic_id, "strikes": 0, "suspended": False}

async def _add_mechanic_strike(db, mechanic_id: int) -> dict:
    """Record one consecutive cancellation; suspend on the 3rd. Returns the new state."""
    row = await db.fetchrow(
        """
        INSERT INTO mechanic_strikes (mechanic_id, strikes, updated_at)
        VALUES ($1, 1, NOW())
        ON CONFLICT (mechanic_id) DO UPDATE
            SET strikes = mechanic_strikes.strikes + 1, updated_at = NOW()
        RETURNING strikes
        """,
        mechanic_id,
    )
    strikes = int(row["strikes"])
    suspended = strikes >= STRIKE_LIMIT
    if suspended:
        await db.execute(
            "UPDATE mechanic_strikes SET suspended = TRUE, suspended_at = NOW() WHERE mechanic_id = $1",
            mechanic_id,
        )
    return {"strikes": strikes, "suspended": suspended}

async def _reset_mechanic_strikes(db, mechanic_id: int) -> None:
    """A completed job is good conduct — clear the consecutive-cancel streak."""
    await db.execute(
        """
        INSERT INTO mechanic_strikes (mechanic_id, strikes, suspended, suspended_at, updated_at)
        VALUES ($1, 0, FALSE, NULL, NOW())
        ON CONFLICT (mechanic_id) DO UPDATE
            SET strikes = 0, suspended = FALSE, suspended_at = NULL, updated_at = NOW()
        """,
        mechanic_id,
    )

@app.get("/mechanics/{mechanic_id}/strikes", tags=["Cancellation"])
async def get_mechanic_strikes(mechanic_id: int, db=Depends(get_db)):
    """Current consecutive-cancellation strike count + suspension state for a mechanic."""
    s = await _get_strike_row(db, mechanic_id)
    return {"mechanic_id": mechanic_id, "strikes": int(s["strikes"]), "suspended": bool(s["suspended"]), "limit": STRIKE_LIMIT}


@app.patch("/requests/{request_id}/status")
async def update_status(
    request_id: int,
    status: str,
    eta_minutes: Optional[int] = None,
    cancel_reason: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    allowed_statuses = ["pending", "accepted", "en_route", "arrived", "service_started", "awaiting_confirmation", "completed", "cancelled"]
    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(allowed_statuses)}"
        )

    # Load request for auth + current state
    row = await db.fetchrow(
        "SELECT id, status, user_id, phone, mechanic_id, customer_name FROM service_requests WHERE id = $1",
        request_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")

    role = (current_user.get("role") or "driver").lower()
    user_id = current_user.get("id")
    user_phone = current_user.get("phone")

    # Authorization
    if role == "admin":
        pass
    elif role == "driver":
        # Drivers may cancel, confirm arrival / service start, mark the job done
        # (awaiting_confirmation), or confirm completion.
        if status not in ("cancelled", "completed", "arrived", "service_started", "awaiting_confirmation"):
            raise HTTPException(status_code=403, detail="Drivers can only cancel, confirm arrival, mark or confirm completion")
        owns = False
        if row.get("user_id") is not None and user_id is not None and int(row["user_id"]) == int(user_id):
            owns = True
        if user_phone and row.get("phone") == user_phone:
            owns = True
        if not owns:
            raise HTTPException(status_code=403, detail="Not allowed")
        # Confirming arrival / service start is only valid while the mechanic is on the way
        if status in ("arrived", "service_started") and row.get("status") not in ("en_route", "arrived"):
            raise HTTPException(status_code=400, detail="Mechanic must be on the way before you can confirm arrival")
        # Driver can mark "done" (awaiting_confirmation) only while service is underway
        if status == "awaiting_confirmation" and row.get("status") not in ("service_started",):
            raise HTTPException(status_code=400, detail="Service must be in progress before marking the job done")
        if status == "completed" and row.get("status") != "awaiting_confirmation":
            raise HTTPException(status_code=400, detail="Can only confirm completion when the job has been marked done")
    elif role == "mechanic":
        # Mechanics drive the journey, can cancel a job they picked up (before work
        # begins), and mark/confirm completion.
        if status not in ("en_route", "arrived", "service_started", "awaiting_confirmation", "completed", "cancelled"):
            raise HTTPException(status_code=403, detail="Mechanics cannot set this status")
        if row.get("mechanic_id") is None or user_id is None or int(row["mechanic_id"]) != int(user_id):
            raise HTTPException(status_code=403, detail="Not assigned to this job")
        # A mechanic may only back out before the work has started.
        if status == "cancelled" and row.get("status") not in ("accepted", "en_route", "arrived"):
            raise HTTPException(status_code=400, detail="You can only cancel before starting the service")
        # Mechanic can confirm completion only when the job is awaiting confirmation
        if status == "completed" and row.get("status") != "awaiting_confirmation":
            raise HTTPException(status_code=400, detail="Can only confirm completion when the job has been marked done")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Timestamp mapping
    ts_column = None
    if status == "en_route":
        ts_column = "en_route_at"
    elif status == "arrived":
        ts_column = "arrived_at"
    elif status == "service_started":
        ts_column = "service_started_at"
    elif status == "completed":
        ts_column = "completed_at"
    elif status == "accepted":
        ts_column = "accepted_at"

    # Store the journey ETA when the mechanic starts driving — both apps derive the
    # shared arrival-time window from en_route_at + eta_minutes.
    if eta_minutes is not None and status == "en_route":
        await db.execute(
            "UPDATE service_requests SET eta_minutes = $1 WHERE id = $2",
            int(eta_minutes), request_id,
        )

    # Record who started the completion handshake + when (drives the confirm prompt
    # on the OTHER party's app and the 30-min auto-complete watchdog).
    if status == "awaiting_confirmation":
        await db.execute(
            "UPDATE service_requests SET awaiting_confirmation_at = NOW(), completion_by = $1 WHERE id = $2",
            role, request_id,
        )

    if ts_column:
        await db.execute(
            f"UPDATE service_requests SET status = $1, {ts_column} = COALESCE({ts_column}, NOW()) WHERE id = $2",
            status,
            request_id,
        )
    else:
        await db.execute(
            "UPDATE service_requests SET status = $1 WHERE id = $2",
            status,
            request_id,
        )

    # Cancellation bookkeeping + mechanic strikes / reset on good conduct.
    cancel_outcome = None  # {"strikes", "suspended", "limit"} when a mechanic cancels
    if status == "cancelled":
        await db.execute(
            "UPDATE service_requests SET cancelled_by = $1, cancel_reason = $2 WHERE id = $3",
            role, cancel_reason, request_id,
        )
        if role == "mechanic" and row.get("mechanic_id") is not None:
            res = await _add_mechanic_strike(db, int(row["mechanic_id"]))
            cancel_outcome = {**res, "limit": STRIKE_LIMIT}
    elif status == "completed" and role == "mechanic" and row.get("mechanic_id") is not None:
        await _reset_mechanic_strikes(db, int(row["mechanic_id"]))

    new_status = status
    phone = row["phone"]
    customer_name = row["customer_name"]

    # ──────── TRIGGER NOTIFICATIONS (best-effort, non-blocking) ────────
    _STATUS_LABELS = {
        "accepted": "A mechanic has accepted your request!",
        "en_route": "Your mechanic is on the way.",
        "arrived": "Your mechanic has arrived at your location.",
        "service_started": "Your mechanic has started working on your vehicle.",
        "awaiting_confirmation": "Your mechanic has marked the job as done. Open the MOTOFIX app to confirm.",
        "completed": "All done! Your job is complete. Thank you for using MOTOFIX.",
        "cancelled": "Your request has been cancelled.",
    }
    push_body = _STATUS_LABELS.get(new_status, f"Request status: {new_status.upper()}")
    # The driver-facing cancel message depends on who pulled out.
    if new_status == "cancelled" and role == "mechanic":
        push_body = "Your mechanic had to cancel this request. Sorry for the inconvenience — you can request another mechanic."
    sms_message = f"Hello {customer_name}, {push_body} [MOTOFIX]"

    notifications_url = os.getenv("NOTIFICATIONS_URL", "http://localhost:8004")

    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{notifications_url}/notify/sms",
                json={"to": phone, "message": sms_message},
                timeout=10.0,
            )
            logger.info("SMS notification sent for request %s (status: %s)", request_id, new_status)
        except Exception as e:
            logger.warning("SMS notification failed for request %s: %s", request_id, e)

        try:
            await client.post(
                f"{notifications_url}/notify/whatsapp",
                json={"to": phone, "message": sms_message},
                timeout=10.0,
            )
            logger.info("WhatsApp notification sent for request %s (status: %s)", request_id, new_status)
        except Exception as e:
            logger.warning("WhatsApp notification failed for request %s: %s", request_id, e)

        # FCM push notification — fetch driver's device token from users table (if available)
        try:
            driver_token_row = await db.fetchrow(
                "SELECT fcm_token FROM users WHERE id = $1", row.get("user_id")
            ) if row.get("user_id") else None
            driver_fcm_token = driver_token_row["fcm_token"] if driver_token_row else None

            if driver_fcm_token:
                await client.post(
                    f"{notifications_url}/notify/push",
                    json={
                        "device_token": driver_fcm_token,
                        "title": "MOTOFIX Update",
                        "body": push_body,
                        "data": {
                            "request_id": str(request_id),
                            "status": new_status,
                            "type": "status_update",
                        },
                    },
                    timeout=10.0,
                )
                logger.info("FCM push sent to driver for request %s (status: %s)", request_id, new_status)
        except Exception as e:
            logger.warning("FCM push notification failed for request %s: %s", request_id, e)

    # Broadcast canonical status update for real-time clients
    snap = await db.fetchrow(
        """
        SELECT id, customer_name, service_type, location, description, status, created_at,
               user_id, mechanic_id, dispatched_at, accepted_at, en_route_at, arrived_at, service_started_at, completed_at, eta_minutes, completion_by
        FROM service_requests WHERE id = $1
        """,
        request_id,
    )
    if snap:
        payload = dict(snap)
        payload["id"] = str(payload["id"])
        if payload.get("created_at"):
            payload["created_at"] = payload["created_at"].isoformat()
        for k in ("dispatched_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
            if payload.get(k):
                payload[k] = payload[k].isoformat()
        await manager.broadcast({
            "type": "status_update",
            "job_id": request_id,
            "status": new_status,
            "cancelled_by": role if new_status == "cancelled" else None,
            "cancel_reason": cancel_reason if new_status == "cancelled" else None,
            "request": payload,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        })

    return {"detail": "Status updated successfully", "new_status": new_status, "cancellation": cancel_outcome}

@app.delete("/requests/{request_id}")
async def delete_request(request_id: int, db=Depends(get_db)):
    query = "DELETE FROM service_requests WHERE id = $1 RETURNING id"
    result = await db.fetchrow(query, request_id)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"detail": "Request deleted successfully"}

# ────────────────────────────── ADMIN DRIVER ENDPOINTS ──────────────────────────────

@app.get("/admin/drivers/{user_id}/requests")
async def get_driver_requests(user_id: int, db=Depends(get_db)):
    """Return all service requests for a specific driver (by user_id)."""
    rows = await db.fetch("""
        SELECT id, service_type, status, location, customer_name,
               mechanic_id, created_at, updated_at
        FROM service_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
    """, user_id)
    return [dict(r) for r in rows]


@app.get("/admin/drivers/{user_id}/payments")
async def get_driver_payments(user_id: int, db=Depends(get_db)):
    """Return payment summary for a specific driver (joined through service_requests)."""
    row = await db.fetchrow("""
        SELECT
            COUNT(p.id)                                                                      AS total_transactions,
            COALESCE(SUM(p.quoted_amount) FILTER (WHERE p.collection_status = 'successful'), 0) AS total_paid,
            COALESCE(SUM(p.quoted_amount) FILTER (WHERE p.collection_status = 'pending'),    0) AS pending_amount,
            MAX(p.created_at)                                                                AS last_transaction_at
        FROM payments p
        JOIN service_requests sr ON p.request_id = sr.id
        WHERE sr.user_id = $1
    """, user_id)
    return dict(row) if row else {"total_transactions": 0, "total_paid": 0, "pending_amount": 0, "last_transaction_at": None}


# ────────────────────────────── STATS ENDPOINTS ──────────────────────────────

@app.get("/stats/")
async def get_stats(db=Depends(get_db)):
    """Public stats endpoint - no auth required"""
    try:
        stats = {}
        try:
            stats["total_requests"] = await db.fetchval("SELECT COUNT(*) FROM service_requests") or 0
        except Exception as e:
            logger.warning(f"Could not fetch total_requests: {e}")
            stats["total_requests"] = 0
            
        try:
            stats["completed_jobs"] = await db.fetchval(
                "SELECT COUNT(*) FROM service_requests WHERE status = 'completed'"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch completed_jobs: {e}")
            stats["completed_jobs"] = 0
            
        try:
            stats["pending_jobs"] = await db.fetchval(
                "SELECT COUNT(*) FROM service_requests WHERE status IN ('pending', 'accepted')"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch pending_jobs: {e}")
            stats["pending_jobs"] = 0
        
        try:
            stats["total_mechanics"] = await db.fetchval("SELECT COUNT(*) FROM mechanics") or 0
        except Exception as e:
            logger.warning(f"Could not fetch total_mechanics: {e}")
            stats["total_mechanics"] = 0
        try:
            stats["verified_mechanics"] = await db.fetchval(
                "SELECT COUNT(*) FROM mechanics WHERE is_verified = true"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch verified_mechanics: {e}")
            stats["verified_mechanics"] = 0

        try:
            stats["revenue_collected_ugx"] = await db.fetchval(
                "SELECT COALESCE(SUM(quoted_amount), 0) FROM payments WHERE collection_status = 'successful'"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch revenue_collected_ugx: {e}")
            stats["revenue_collected_ugx"] = 0

        try:
            stats["paid_to_mechanics_ugx"] = await db.fetchval(
                "SELECT COALESCE(SUM(mechanic_payout), 0) FROM payments WHERE disbursement_status = 'successful'"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch paid_to_mechanics_ugx: {e}")
            stats["paid_to_mechanics_ugx"] = 0

        stats["profit_ugx"] = stats["revenue_collected_ugx"] - stats["paid_to_mechanics_ugx"]

        try:
            stats["total_transactions"] = await db.fetchval("SELECT COUNT(*) FROM payments") or 0
        except Exception as e:
            logger.warning(f"Could not fetch total_transactions: {e}")
            stats["total_transactions"] = 0

        try:
            stats["commission_earned_ugx"] = await db.fetchval(
                "SELECT COALESCE(SUM(commission), 0) FROM payments WHERE collection_status = 'successful'"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch commission_earned_ugx: {e}")
            stats["commission_earned_ugx"] = 0

        try:
            stats["pending_collections_ugx"] = await db.fetchval(
                "SELECT COALESCE(SUM(quoted_amount), 0) FROM payments WHERE collection_status = 'pending'"
            ) or 0
        except Exception as e:
            logger.warning(f"Could not fetch pending_collections_ugx: {e}")
            stats["pending_collections_ugx"] = 0

        stats["as_of"] = datetime.utcnow().isoformat() + "Z"
        
        logger.info(f"📊 Stats endpoint called: {stats['total_requests']} total requests")
        return stats
    except Exception as e:
        logger.error(f"❌ Stats endpoint error: {str(e)}", exc_info=True)
        # Return safe defaults instead of crashing
        return {
            "total_requests": 0,
            "completed_jobs": 0,
            "pending_jobs": 0,
            "total_mechanics": 0,
            "verified_mechanics": 0,
            "revenue_collected_ugx": 0,
            "paid_to_mechanics_ugx": 0,
            "profit_ugx": 0,
            "total_transactions": 0,
            "as_of": datetime.utcnow().isoformat() + "Z",
            "error": str(e)
        }

# ────────────────────────────── REVENUE ENDPOINTS ──────────────────────────────

@app.get("/revenue/")
async def get_revenue(days: int = 30, db=Depends(get_db)):
    """
    Returns daily collected revenue (UGX) from successful payments for the last N days.
    Falls back to daily request counts if no payment data exists yet.
    """
    try:
        payment_query = """
            SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
                   COALESCE(SUM(quoted_amount), 0)::bigint AS amount
            FROM payments
            WHERE collection_status = 'successful'
              AND created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY date
            ORDER BY date ASC
        """
        rows = await db.fetch(payment_query, str(days))

        if rows:
            data = [{"date": r["date"], "amount": int(r["amount"])} for r in rows]
            logger.info(f"📈 Revenue endpoint: {len(data)} days of payment data")
            return data

        # No payments yet — fall back to request counts so the chart isn't empty
        fallback_query = """
            SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
                   COUNT(*) AS amount
            FROM service_requests
            WHERE created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY date
            ORDER BY date ASC
        """
        fallback_rows = await db.fetch(fallback_query, str(days))
        data = [{"date": r["date"], "amount": int(r["amount"])} for r in fallback_rows]
        logger.info(f"📈 Revenue endpoint: no payments yet, returning {len(data)} days of request counts")
        return data

    except Exception as e:
        logger.error(f"❌ Revenue endpoint error: {str(e)}", exc_info=True)
        return []

# ════════════════════════════════ PAYMENTS & MTN MOMO ════════════════════════════════

# ── MoMo configuration ────────────────────────────────────────────────────────

MOMO_ENV = os.getenv("MOMO_ENVIRONMENT", "sandbox")
MOMO_BASE_URL = (
    "https://sandbox.momodeveloper.mtn.com"
    if MOMO_ENV == "sandbox"
    else "https://momodeveloper.mtn.com"
)
# Sandbox only accepts EUR; production uses UGX
MOMO_CURRENCY = os.getenv("MOMO_CURRENCY", "EUR" if MOMO_ENV == "sandbox" else "UGX")
MOMO_CALLBACK_URL = os.getenv(
    "MOMO_CALLBACK_URL",
    "https://motofix-dispatch.onrender.com/payments/callback",
)

MOMO_COL_USER_ID = os.getenv("MOMO_COLLECTIONS_USER_ID", "")
MOMO_COL_API_KEY = os.getenv("MOMO_COLLECTIONS_API_KEY", "")
MOMO_COL_PRIMARY_KEY = os.getenv("MOMO_COLLECTIONS_PRIMARY_KEY", "")

MOMO_DIS_USER_ID = os.getenv("MOMO_DISBURSEMENTS_USER_ID", "")
MOMO_DIS_API_KEY = os.getenv("MOMO_DISBURSEMENTS_API_KEY", "")
MOMO_DIS_PRIMARY_KEY = os.getenv("MOMO_DISBURSEMENTS_PRIMARY_KEY", "")

PLATFORM_COMMISSION = 10000  # UGX 10,000 flat commission per job


# ── MoMo Pydantic models ─────────────────────────────────────────────────────

class QuoteRequest(BaseModel):
    request_id: int
    quoted_amount: int
    mechanic_phone: Optional[str] = None  # supplied by client as fallback


class CollectRequest(BaseModel):
    phone: str  # driver's MTN MoMo number


# ── MoMo helper functions ────────────────────────────────────────────────────

async def _get_momo_token(service: str) -> str:
    """Obtain a Bearer token for the given MoMo service ('collection'|'disbursement')."""
    if service == "collection":
        user_id, api_key, primary_key = MOMO_COL_USER_ID, MOMO_COL_API_KEY, MOMO_COL_PRIMARY_KEY
    else:
        user_id, api_key, primary_key = MOMO_DIS_USER_ID, MOMO_DIS_API_KEY, MOMO_DIS_PRIMARY_KEY

    logger.info(f"🔐 _get_momo_token: requesting {service} token from {MOMO_BASE_URL}/{service}/token/")
    credentials = base64.b64encode(f"{user_id}:{api_key}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOMO_BASE_URL}/{service}/token/",
            headers={
                "Authorization": f"Basic {credentials}",
                "Ocp-Apim-Subscription-Key": primary_key,
            },
            timeout=30,
        )
        logger.info(f"🔐 _get_momo_token: token endpoint responded {resp.status_code}")
        if resp.status_code != 200:
            logger.error(f"🔐 _get_momo_token: error body: {resp.text}")
        resp.raise_for_status()
        token = resp.json()["access_token"]
        logger.info(f"🔑 MoMo token obtained: {token[:20]}...")
        return token


async def _mtn_collection_status(reference_id: str) -> str:
    """Query MTN for the current status of a requesttopay. Returns MTN status string
    (e.g. 'SUCCESSFUL', 'FAILED', 'PENDING') or 'RESOURCE_NOT_FOUND' if unknown."""
    try:
        token = await _get_momo_token("collection")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MOMO_BASE_URL}/collection/v1_0/requesttopay/{reference_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Target-Environment": MOMO_ENV,
                    "Ocp-Apim-Subscription-Key": MOMO_COL_PRIMARY_KEY,
                },
                timeout=15,
            )
        logger.info(f"🔍 _mtn_collection_status: ref={reference_id} status={resp.status_code} body={resp.text}")
        if resp.status_code == 404:
            return "RESOURCE_NOT_FOUND"
        resp.raise_for_status()
        return resp.json().get("status", "UNKNOWN").upper()
    except Exception as e:
        logger.warning(f"⚠️  _mtn_collection_status: could not query MTN for {reference_id}: {e}")
        return "UNKNOWN"


async def _initiate_collection(payment_id: int, amount: int, driver_phone: str, request_id: int, db) -> str:
    """Request payment from driver via MoMo Collections. Returns the X-Reference-Id."""
    reference_id = str(uuid.uuid4())
    logger.info(f"📲 _initiate_collection: payment_id={payment_id} amount={amount} driver_phone={driver_phone} reference_id={reference_id}")

    token = await _get_momo_token("collection")
    msisdn = driver_phone.lstrip("+")
    logger.info(f"📲 _initiate_collection: msisdn={msisdn} env={MOMO_ENV} currency={MOMO_CURRENCY}")

    payload = {
        "amount": str(amount),
        "currency": MOMO_CURRENCY,
        "externalId": f"motofix-{request_id}",
        "payer": {"partyIdType": "MSISDN", "partyId": msisdn},
        "payerMessage": f"MotoFix payment Job {request_id}",
        "payeeNote": f"MotoFix Job {request_id}",
    }
    logger.info(f"📲 _initiate_collection: request-to-pay payload: {payload}")

    # Build headers — omit X-Callback-Url in sandbox (MTN WAF rejects unregistered callback URLs).
    # Status is polled actively via payment_status endpoint so callbacks are not required.
    req_headers: dict = {
        "Authorization": f"Bearer {token}",
        "X-Reference-Id": reference_id,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": MOMO_COL_PRIMARY_KEY,
        "Content-Type": "application/json",
    }
    if MOMO_ENV != "sandbox" and MOMO_CALLBACK_URL:
        req_headers["X-Callback-Url"] = MOMO_CALLBACK_URL

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOMO_BASE_URL}/collection/v1_0/requesttopay",
            headers=req_headers,
            json=payload,
            timeout=30,
        )
        logger.info(f"📱 MTN response status: {resp.status_code}")
        logger.info(f"📱 MTN response body: {resp.text}")

        # Detect WAF/gateway HTML rejection (sometimes returned as HTTP 200)
        is_html = resp.text.lstrip().startswith("<")
        if is_html or resp.status_code not in (200, 202):
            logger.error(f"MoMo collection error {resp.status_code}: {resp.text}")
            raise HTTPException(status_code=502, detail=f"MoMo payment initiation failed: {resp.text}")

    await db.execute(
        "UPDATE payments SET collection_reference=$1, collection_status='initiated', provider='mtn' WHERE id=$2",
        reference_id, payment_id,
    )
    logger.info(f"📲 _initiate_collection: DB updated — collection_status='initiated' for payment {payment_id}")
    return reference_id


async def _initiate_disbursement(payment_id: int, amount: int, mechanic_phone: str, request_id: int, db) -> str:
    """Transfer payout to mechanic via MoMo Disbursements. Returns the X-Reference-Id."""
    reference_id = str(uuid.uuid4())
    token = await _get_momo_token("disbursement")
    msisdn = mechanic_phone.lstrip("+")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MOMO_BASE_URL}/disbursement/v1_0/transfer",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Reference-Id": reference_id,
                "X-Target-Environment": MOMO_ENV,
                "X-Callback-Url": MOMO_CALLBACK_URL,
                "Ocp-Apim-Subscription-Key": MOMO_DIS_PRIMARY_KEY,
                "Content-Type": "application/json",
            },
            json={
                "amount": str(amount),
                "currency": MOMO_CURRENCY,
                "externalId": f"motofix-payout-{request_id}",
                "payee": {"partyIdType": "MSISDN", "partyId": msisdn},
                "payerMessage": f"MotoFix payout for Job #{request_id}",
                "payeeNote": f"Your MotoFix earnings – Job #{request_id}",
            },
            timeout=30,
        )
        if resp.status_code not in (200, 202):
            logger.error(f"MoMo disbursement error {resp.status_code}: {resp.text}")
            raise HTTPException(status_code=502, detail=f"MoMo disbursement failed: {resp.text}")

    await db.execute(
        "UPDATE payments SET disbursement_reference=$1, disbursement_status='initiated' WHERE id=$2",
        reference_id, payment_id,
    )
    return reference_id


# ── Airtel Money configuration ────────────────────────────────────────────────

AIRTEL_ENV = os.getenv("AIRTEL_ENV", "sandbox")
AIRTEL_BASE_URL = (
    "https://openapiuat.airtel.africa"
    if AIRTEL_ENV == "sandbox"
    else "https://openapi.airtel.africa"
)
AIRTEL_CLIENT_ID     = os.getenv("AIRTEL_CLIENT_ID", "")
AIRTEL_CLIENT_SECRET = os.getenv("AIRTEL_CLIENT_SECRET", "")
AIRTEL_MERCHANT_PIN  = os.getenv("AIRTEL_MERCHANT_PIN", "")
AIRTEL_CURRENCY = "UGX"
AIRTEL_COUNTRY  = "UG"


def _detect_provider(phone: str) -> str:
    """Detect mobile money provider from Uganda phone number. Returns 'mtn' or 'airtel'."""
    n = phone.lstrip("+").strip()
    # MTN Uganda: 077x, 078x, 031x, 039x (in +256 format: 25677, 25678, 25631, 25639)
    if any(n.startswith(p) for p in ("25677", "25678", "25631", "25639")):
        return "mtn"
    # Airtel Uganda: 070x, 074x, 075x, 020x, 030x (in +256 format)
    if any(n.startswith(p) for p in ("25670", "25674", "25675", "25620", "25630")):
        return "airtel"
    return "mtn"  # default


async def _get_airtel_token() -> str:
    """Obtain an OAuth2 bearer token for the Airtel Money API."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AIRTEL_BASE_URL}/auth/oauth2/token",
            headers={"Content-Type": "application/json", "Accept": "*/*"},
            json={
                "client_id": AIRTEL_CLIENT_ID,
                "client_secret": AIRTEL_CLIENT_SECRET,
                "grant_type": "client_credentials",
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _airtel_collection_status(transaction_id: str) -> str:
    """Query Airtel for the current status of a collection.
    Returns normalised status: 'SUCCESSFUL', 'FAILED', 'PENDING', or 'RESOURCE_NOT_FOUND'."""
    try:
        token = await _get_airtel_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{AIRTEL_BASE_URL}/standard/v1/payments/{transaction_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Country": AIRTEL_COUNTRY,
                    "X-Currency": AIRTEL_CURRENCY,
                    "Accept": "*/*",
                },
                timeout=15,
            )
        if resp.status_code == 404:
            return "RESOURCE_NOT_FOUND"
        resp.raise_for_status()
        raw = resp.json().get("data", {}).get("transaction", {}).get("status", "TP")
        # TS=Successful, TF=Failed, TP=Pending, TIP=In-Progress
        if raw == "TS":
            return "SUCCESSFUL"
        if raw == "TF":
            return "FAILED"
        return "PENDING"
    except Exception as e:
        logger.warning(f"⚠️  _airtel_collection_status error for {transaction_id}: {e}")
        return "UNKNOWN"


async def _initiate_airtel_collection(payment_id: int, amount: int, driver_phone: str, request_id: int, db) -> str:
    """Request payment from driver via Airtel Money. Returns the transaction reference UUID."""
    reference_id = str(uuid.uuid4())
    token = await _get_airtel_token()
    msisdn = driver_phone.lstrip("+").strip()
    logger.info(f"📲 _initiate_airtel_collection: payment={payment_id} amount={amount} msisdn={msisdn}")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AIRTEL_BASE_URL}/merchant/v1/payments/",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Country": AIRTEL_COUNTRY,
                "X-Currency": AIRTEL_CURRENCY,
                "Content-Type": "application/json",
                "Accept": "*/*",
            },
            json={
                "reference": f"MotoFix Job {request_id}",
                "subscriber": {
                    "country": AIRTEL_COUNTRY,
                    "currency": AIRTEL_CURRENCY,
                    "msisdn": msisdn,
                },
                "transaction": {
                    "amount": amount,
                    "country": AIRTEL_COUNTRY,
                    "currency": AIRTEL_CURRENCY,
                    "id": reference_id,
                },
            },
            timeout=30,
        )

    logger.info(f"📱 Airtel collection response: {resp.status_code} {resp.text}")
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Airtel payment initiation failed: {resp.text}")
    data = resp.json()
    if not data.get("status", {}).get("success", False):
        raise HTTPException(status_code=502, detail=f"Airtel payment rejected: {data}")

    await db.execute(
        "UPDATE payments SET collection_reference=$1, collection_status='initiated', provider='airtel' WHERE id=$2",
        reference_id, payment_id,
    )
    return reference_id


async def _initiate_airtel_disbursement(payment_id: int, amount: int, mechanic_phone: str, request_id: int, db) -> str:
    """Transfer payout to mechanic via Airtel Money B2C. Returns the transaction reference UUID."""
    reference_id = str(uuid.uuid4())
    token = await _get_airtel_token()
    msisdn = mechanic_phone.lstrip("+").strip()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AIRTEL_BASE_URL}/standard/v1/disbursements/",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Country": AIRTEL_COUNTRY,
                "X-Currency": AIRTEL_CURRENCY,
                "Content-Type": "application/json",
                "Accept": "*/*",
            },
            json={
                "payee": {"msisdn": msisdn},
                "reference": f"MotoFix payout Job {request_id}",
                "pin": AIRTEL_MERCHANT_PIN,
                "transaction": {
                    "amount": amount,
                    "id": reference_id,
                    "type": "B2C",
                },
            },
            timeout=30,
        )

    logger.info(f"📱 Airtel disbursement response: {resp.status_code} {resp.text}")
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Airtel disbursement failed: {resp.text}")

    await db.execute(
        "UPDATE payments SET disbursement_reference=$1, disbursement_status='initiated' WHERE id=$2",
        reference_id, payment_id,
    )
    return reference_id


# ── Payment endpoints ─────────────────────────────────────────────────────────

@app.post("/payments/quote")
async def submit_quote(body: QuoteRequest, user=Depends(get_current_user), db=Depends(get_db)):
    """Mechanic submits a price quote. Called before or after accepting the job."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    if user.get("role") != "mechanic":
        raise HTTPException(status_code=403, detail="Only mechanics can submit quotes")

    mechanic_id = user["id"]

    request_row = await db.fetchrow("SELECT phone FROM service_requests WHERE id=$1", body.request_id)
    if not request_row:
        raise HTTPException(status_code=404, detail="Service request not found")

    # Prefer DB phone; fall back to value sent by client
    mechanic_row = await db.fetchrow("SELECT phone FROM mechanics WHERE id=$1", mechanic_id)
    mechanic_phone = (mechanic_row["phone"] if mechanic_row else None) or body.mechanic_phone or ""
    driver_phone = request_row["phone"]

    mechanic_payout = body.quoted_amount - PLATFORM_COMMISSION

    existing = await db.fetchrow("SELECT id FROM payments WHERE request_id=$1", body.request_id)
    if existing:
        row = await db.fetchrow(
            """UPDATE payments
               SET quoted_amount=$1, commission=$2, mechanic_payout=$3,
                   mechanic_id=$4, mechanic_phone=$5, driver_phone=$6
               WHERE request_id=$7 RETURNING *""",
            body.quoted_amount, PLATFORM_COMMISSION, mechanic_payout,
            mechanic_id, mechanic_phone, driver_phone, body.request_id,
        )
    else:
        row = await db.fetchrow(
            """INSERT INTO payments
               (request_id, mechanic_id, mechanic_phone, driver_phone, quoted_amount, commission, mechanic_payout)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *""",
            body.request_id, mechanic_id, mechanic_phone, driver_phone,
            body.quoted_amount, PLATFORM_COMMISSION, mechanic_payout,
        )

    result = dict(row)
    result.pop("driver_phone", None)
    result.pop("mechanic_phone", None)
    return result


@app.get("/payments/quote/{request_id}")
async def get_quote(request_id: int, db=Depends(get_db)):
    """Driver or mechanic fetches the current price quote for a job. No auth required — quote amount is not sensitive."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    row = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not row:
        raise HTTPException(status_code=404, detail="No quote found for this request")
    result = dict(row)
    result.pop("driver_phone", None)
    result.pop("mechanic_phone", None)
    return result


@app.post("/payments/approve/{request_id}")
async def approve_quote(request_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """Driver approves the mechanic's price quote."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    request_row = await db.fetchrow("SELECT phone FROM service_requests WHERE id=$1", request_id)
    if not request_row:
        raise HTTPException(status_code=404, detail="Request not found")

    if user.get("phone") != request_row["phone"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve this quote")

    payment = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not payment:
        raise HTTPException(status_code=404, detail="No quote found for this request")

    if payment["quote_approved"]:
        return {"detail": "Quote already approved", "request_id": request_id}

    await db.execute("UPDATE payments SET quote_approved=TRUE WHERE request_id=$1", request_id)
    return {"detail": "Quote approved", "request_id": request_id}


@app.post("/payments/collect/{request_id}")
async def collect_payment(request_id: int, body: CollectRequest, user=Depends(get_current_user), db=Depends(get_db)):
    """Initiate MTN MoMo collection from driver after job completion."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    logger.info(f"🔄 collect called for request_id={request_id} by user={user.get('phone')}")

    request_row = await db.fetchrow("SELECT phone, status FROM service_requests WHERE id=$1", request_id)
    if not request_row:
        logger.warning(f"❌ collect: request {request_id} not found")
        raise HTTPException(status_code=404, detail="Request not found")

    def _normalise_phone(p: str) -> str:
        return (p or "").lstrip("+").strip()

    user_phone = user.get("phone")
    if user_phone:
        # Token carries phone — compare directly (handles +256 vs 256 format differences)
        if _normalise_phone(user_phone) != _normalise_phone(request_row["phone"]):
            logger.warning(f"❌ collect: auth mismatch — token phone={user_phone} request phone={request_row['phone']}")
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        # Old token without phone claim — still authenticated, log and continue
        logger.warning(f"⚠️  collect: token for user id={user.get('id')} has no phone claim; skipping phone check")

    payment = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not payment:
        logger.warning(f"❌ collect: no payment record for request {request_id}")
        raise HTTPException(status_code=404, detail="No quote found – mechanic must submit a quote first")

    logger.info(f"📋 collect: payment id={payment['id']} quote_approved={payment['quote_approved']} collection_status={payment['collection_status']}")

    if request_row["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Payment is only available after the job is completed (current: {request_row['status']})")

    # Auto-approve quote at payment time — driver confirming payment is implicit approval
    if not payment["quote_approved"]:
        await db.execute("UPDATE payments SET quote_approved=TRUE WHERE id=$1", payment["id"])
        payment = dict(payment)
        payment["quote_approved"] = True
        logger.info(f"✅ collect: auto-approved quote for payment {payment['id']}")

    if payment["collection_status"] == "successful":
        logger.info(f"⏭️  collect: already succeeded for payment {payment['id']}, returning early")
        return {
            "detail": "Payment already success",
            "reference_id": payment["collection_reference"],
            "amount": payment["quoted_amount"],
        }

    if payment["collection_status"] == "initiated":
        ref = payment["collection_reference"]
        _prov = payment.get("provider") or "mtn"
        if _prov == "airtel":
            _current_status = await _airtel_collection_status(ref) if ref else "RESOURCE_NOT_FOUND"
        else:
            _current_status = await _mtn_collection_status(ref) if ref else "RESOURCE_NOT_FOUND"
        logger.info(f"🔍 collect: DB says initiated, {_prov} says {_current_status} for ref={ref}")
        if _current_status not in ("RESOURCE_NOT_FOUND", "FAILED", "TIMEOUT", "EXPIRED", "UNKNOWN"):
            # MTN knows about it and it's still pending or succeeded — don't double-charge
            return {
                "detail": "Payment already initiated",
                "reference_id": ref,
                "amount": payment["quoted_amount"],
            }
        # Ghost/failed reference — reset so we can try again
        logger.info(f"🔄 collect: resetting ghost/failed reference {ref} for payment {payment['id']}")
        await db.execute(
            "UPDATE payments SET collection_status='pending', collection_reference=NULL WHERE id=$1",
            payment["id"],
        )
        payment = await db.fetchrow("SELECT * FROM payments WHERE id=$1", payment["id"])

    driver_phone = body.phone or payment["driver_phone"] or request_row["phone"]
    provider = _detect_provider(driver_phone)
    logger.info(f"📞 collect: driver_phone={driver_phone} provider={provider}")

    try:
        if provider == "airtel":
            reference_id = await _initiate_airtel_collection(
                payment["id"], payment["quoted_amount"], driver_phone, request_id, db
            )
        else:
            reference_id = await _initiate_collection(
                payment["id"], payment["quoted_amount"], driver_phone, request_id, db
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 collect: unexpected error for payment {payment['id']}: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Payment initiation failed. Please try again.")

    logger.info(f"✅ collect: initiated reference_id={reference_id} for payment {payment['id']}")
    return {"detail": "Payment initiated", "reference_id": reference_id, "amount": payment["quoted_amount"]}


@app.post("/payments/cash/{request_id}", tags=["Payments"])
async def pay_cash(request_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """Record a cash payment for a completed job. Sets collection_status='cash'."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")

    request_row = await db.fetchrow("SELECT phone, status FROM service_requests WHERE id=$1", request_id)
    if not request_row:
        raise HTTPException(status_code=404, detail="Request not found")

    if request_row["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Cash payment only available after job completion (current: {request_row['status']})",
        )

    payment = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not payment:
        raise HTTPException(status_code=404, detail="No quote found – mechanic must submit a quote first")

    if payment["collection_status"] in ("successful", "cash"):
        return {"detail": "Payment already recorded", "amount": payment["quoted_amount"]}

    await db.execute(
        "UPDATE payments SET collection_status='cash', quote_approved=TRUE WHERE id=$1",
        payment["id"],
    )
    logger.info(f"💵 cash payment: request {request_id} marked as cash-paid (payment {payment['id']})")
    return {"detail": "Cash payment recorded", "amount": payment["quoted_amount"]}


@app.get("/payments/status/{request_id}")
async def payment_status(request_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """Check payment status for a job. Actively syncs with MTN when status is 'initiated'."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    row = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not row:
        raise HTTPException(status_code=404, detail="No payment record found")

    if row["collection_status"] == "initiated" and row["collection_reference"]:
        _row_provider = row.get("provider") or "mtn"
        if _row_provider == "airtel":
            _status = await _airtel_collection_status(row["collection_reference"])
        else:
            _status = await _mtn_collection_status(row["collection_reference"])
        logger.info(f"📊 payment_status: request={request_id} {_row_provider} status={_status}")

        if _status == "SUCCESSFUL":
            await db.execute("UPDATE payments SET collection_status='successful' WHERE id=$1", row["id"])
            try:
                if _row_provider == "airtel":
                    await _initiate_airtel_disbursement(row["id"], row["mechanic_payout"], row["mechanic_phone"], request_id, db)
                else:
                    await _initiate_disbursement(row["id"], row["mechanic_payout"], row["mechanic_phone"], request_id, db)
            except Exception as e:
                logger.error(f"Auto-disbursement failed for payment {row['id']}: {e}")
            row = await db.fetchrow("SELECT * FROM payments WHERE id=$1", row["id"])
        elif _status in ("FAILED", "TIMEOUT", "EXPIRED"):
            await db.execute("UPDATE payments SET collection_status='failed' WHERE id=$1", row["id"])
            row = await db.fetchrow("SELECT * FROM payments WHERE id=$1", row["id"])
        elif _status == "RESOURCE_NOT_FOUND":
            age_seconds = (datetime.utcnow() - row["created_at"].replace(tzinfo=None)).total_seconds()
            if age_seconds > 180:
                logger.warning(f"📊 payment_status: ref={row['collection_reference']} not found in {_row_provider} after {age_seconds:.0f}s — marking failed")
                await db.execute(
                    "UPDATE payments SET collection_status='failed', collection_reference=NULL WHERE id=$1",
                    row["id"],
                )
                row = await db.fetchrow("SELECT * FROM payments WHERE id=$1", row["id"])
            else:
                logger.info(f"📊 payment_status: ref={row['collection_reference']} not found in {_row_provider} yet (age {age_seconds:.0f}s) — waiting")

    result = dict(row)
    result.pop("driver_phone", None)
    result.pop("mechanic_phone", None)
    return result


@app.post("/payments/callback")
async def momo_callback(request: Request, db=Depends(get_db)):
    """Payment webhook callback — handles both MTN MoMo and Airtel Money events."""
    if not await is_feature_enabled(db, "payments", default=False):
        logger.info("Payment callback received but payments are disabled; ignoring.")
        return {"detail": "ok"}
    try:
        body = await request.json()
    except Exception:
        body = {}

    logger.info(f"Payment callback: {body}")

    # MTN MoMo reference fields
    reference_id = (
        body.get("referenceId")
        or body.get("financialTransactionId")
        or body.get("externalId")
        or body.get("X-Reference-Id")
    )
    raw_status = (body.get("status") or "").upper()

    # Airtel Money reference fields (nested under data.transaction)
    airtel_txn = body.get("data", {}).get("transaction", {})
    if not reference_id and airtel_txn:
        reference_id = airtel_txn.get("id")
        airtel_raw = airtel_txn.get("status", "")
        raw_status = "SUCCESSFUL" if airtel_raw == "TS" else ("FAILED" if airtel_raw == "TF" else airtel_raw.upper())

    if not reference_id:
        return {"detail": "ok"}

    is_success = raw_status in ("SUCCESSFUL", "SUCCESS")
    is_failed = raw_status in ("FAILED", "TIMEOUT", "EXPIRED")

    # Check collections first
    payment = await db.fetchrow("SELECT * FROM payments WHERE collection_reference=$1", reference_id)
    if payment:
        if is_success:
            await db.execute("UPDATE payments SET collection_status='successful' WHERE id=$1", payment["id"])
            try:
                _cb_provider = payment.get("provider") or "mtn"
                if _cb_provider == "airtel":
                    await _initiate_airtel_disbursement(
                        payment["id"], payment["mechanic_payout"],
                        payment["mechanic_phone"], payment["request_id"], db,
                    )
                else:
                    await _initiate_disbursement(
                        payment["id"], payment["mechanic_payout"],
                        payment["mechanic_phone"], payment["request_id"], db,
                    )
                logger.info(f"Auto-disbursement triggered for payment {payment['id']}")
            except Exception as e:
                logger.error(f"Auto-disbursement failed for payment {payment['id']}: {e}")
        elif is_failed:
            await db.execute("UPDATE payments SET collection_status='failed' WHERE id=$1", payment["id"])
        return {"detail": "collection processed"}

    # Check disbursements
    payment = await db.fetchrow("SELECT * FROM payments WHERE disbursement_reference=$1", reference_id)
    if payment:
        if is_success:
            await db.execute("UPDATE payments SET disbursement_status='successful' WHERE id=$1", payment["id"])
        elif is_failed:
            await db.execute("UPDATE payments SET disbursement_status='failed' WHERE id=$1", payment["id"])
        return {"detail": "disbursement processed"}

    return {"detail": "ok"}


@app.post("/payments/disburse/{request_id}")
async def trigger_disbursement(request_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """Manually trigger mechanic payout (admin fallback if auto-disburse failed)."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    payment = await db.fetchrow("SELECT * FROM payments WHERE request_id=$1", request_id)
    if not payment:
        raise HTTPException(status_code=404, detail="No payment found")

    if payment["collection_status"] != "successful":
        raise HTTPException(status_code=400, detail="Collection must succeed before disbursement")

    if payment["disbursement_status"] in ("initiated", "successful"):
        return {"detail": "Disbursement already " + payment["disbursement_status"]}

    try:
        _dis_provider = payment.get("provider") or _detect_provider(payment["mechanic_phone"] or "")
        if _dis_provider == "airtel":
            reference_id = await _initiate_airtel_disbursement(
                payment["id"], payment["mechanic_payout"],
                payment["mechanic_phone"], request_id, db,
            )
        else:
            reference_id = await _initiate_disbursement(
                payment["id"], payment["mechanic_payout"],
                payment["mechanic_phone"], request_id, db,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Disbursement error: {e}")
        raise HTTPException(status_code=502, detail="Disbursement failed")

    return {"detail": "Disbursement initiated", "reference_id": reference_id}


@app.get("/payments/earnings/{mechanic_id}")
async def mechanic_earnings(mechanic_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """Mechanic's earnings history with totals."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    rows = await db.fetch(
        """SELECT p.id, p.request_id, p.quoted_amount, p.commission, p.mechanic_payout,
                  p.collection_status, p.disbursement_status, p.created_at,
                  sr.customer_name, sr.service_type
           FROM payments p
           JOIN service_requests sr ON p.request_id = sr.id
           WHERE p.mechanic_id = $1
           ORDER BY p.created_at DESC""",
        mechanic_id,
    )

    earnings = [dict(r) for r in rows]
    now = datetime.utcnow()

    total_earned = sum(
        (e["mechanic_payout"] or 0) for e in earnings if e["disbursement_status"] == "successful"
    )
    this_month = sum(
        (e["mechanic_payout"] or 0)
        for e in earnings
        if e["disbursement_status"] == "successful"
        and e["created_at"].month == now.month
        and e["created_at"].year == now.year
    )

    return {"total_earned": total_earned, "this_month": this_month, "earnings": earnings}


@app.get("/payments/transactions")
async def all_transactions(page: int = 1, page_size: int = 50, db=Depends(get_db)):
    """All payment transactions – used by admin dashboard."""
    if not await is_feature_enabled(db, "payments", default=False):
        raise HTTPException(status_code=404, detail="Payments feature is disabled")
    offset = (page - 1) * page_size
    rows = await db.fetch(
        """SELECT p.id, p.request_id, p.quoted_amount, p.commission, p.mechanic_payout,
                  p.collection_status, p.disbursement_status, p.collection_reference,
                  p.disbursement_reference, p.created_at,
                  sr.customer_name, sr.phone as driver_phone,
                  m.full_name as mechanic_name, p.mechanic_id
           FROM payments p
           JOIN service_requests sr ON p.request_id = sr.id
           LEFT JOIN mechanics m ON p.mechanic_id = m.id
           ORDER BY p.created_at DESC
           LIMIT $1 OFFSET $2""",
        page_size, offset,
    )
    total = await db.fetchval("SELECT COUNT(*) FROM payments") or 0
    return {"data": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


# ────────────────────────────── CORS DEBUG ENDPOINTS ──────────────────────────────
# ════════════════════════════════ REVIEWS & RATINGS ════════════════════════════════

class ReviewCreate(BaseModel):
    rating: int      # 1–5
    comment: str = ""


class ReviewOut(BaseModel):
    id: int
    request_id: int
    mechanic_id: int
    reviewer_id: int
    rating: int
    comment: str
    direction: Optional[str] = "driver_to_mechanic"
    created_at: Optional[str] = None


@app.post("/requests/{request_id}/review", response_model=ReviewOut, tags=["Reviews"])
async def submit_review(
    request_id: int,
    body: ReviewCreate,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Submit a star rating + optional comment after a job is completed.
    - Drivers submit direction='driver_to_mechanic' (rating the mechanic).
    - Mechanics submit direction='mechanic_to_driver' (rating the driver).
    - One review per direction per request (UNIQUE on request_id, direction).
    - Driver reviews update the mechanic's rolling avg_rating.
    """
    role = (current_user.get("role") or "driver").lower()
    if role not in ("driver", "mechanic", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to leave a review")

    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")

    # Load the request
    req_row = await db.fetchrow(
        "SELECT id, status, user_id, phone, mechanic_id FROM service_requests WHERE id = $1",
        request_id,
    )
    if not req_row:
        raise HTTPException(status_code=404, detail="Request not found")

    if req_row["status"] not in ("completed", "awaiting_confirmation"):
        raise HTTPException(
            status_code=400,
            detail=f"Reviews are only allowed for completed jobs (current status: {req_row['status']})"
        )

    mechanic_id = req_row.get("mechanic_id")
    if not mechanic_id:
        raise HTTPException(status_code=400, detail="No mechanic assigned to this request")

    # Verify ownership and set direction
    if role == "mechanic":
        direction = "mechanic_to_driver"
        caller_id = current_user.get("id")
        if caller_id is not None and int(caller_id) != int(mechanic_id):
            raise HTTPException(status_code=403, detail="Not authorized to review this request")
    else:
        direction = "driver_to_mechanic"
        uid = current_user.get("id")
        phone = current_user.get("phone")
        owns = (
            (req_row.get("user_id") is not None and uid is not None and int(req_row["user_id"]) == int(uid))
            or (phone and req_row.get("phone") == phone)
        )
        if role == "driver" and not owns:
            raise HTTPException(status_code=403, detail="Not authorized to review this request")

    reviewer_id = int(current_user.get("id"))

    try:
        row = await db.fetchrow(
            """
            INSERT INTO reviews (request_id, mechanic_id, reviewer_id, rating, comment, direction)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, request_id, mechanic_id, reviewer_id, rating, comment, direction, created_at
            """,
            request_id, mechanic_id, reviewer_id, body.rating, body.comment, direction,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="You have already reviewed this job")
        raise HTTPException(status_code=500, detail=f"Failed to save review: {e}")

    # Update mechanic's rolling avg_rating — only for driver-to-mechanic reviews
    if direction == "driver_to_mechanic":
        try:
            await db.execute(
                """
                UPDATE mechanics
                SET total_ratings  = COALESCE(total_ratings, 0) + 1,
                    rating         = (
                        (COALESCE(rating, 0) * COALESCE(total_ratings, 0) + $1)
                        / (COALESCE(total_ratings, 0) + 1)
                    )
                WHERE id = $2
                """,
                float(body.rating), mechanic_id,
            )
            logger.info("✅ Mechanic %s rating updated after review on request %s", mechanic_id, request_id)
        except Exception as e:
            logger.warning("⚠️  Could not update mechanic rating (non-fatal): %s", e)

    result = dict(row)
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()

    return result


@app.get("/requests/{request_id}/review", response_model=ReviewOut, tags=["Reviews"])
async def get_review(
    request_id: int,
    direction: str = "driver_to_mechanic",
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch the review for a specific completed job. Use direction=mechanic_to_driver for mechanic's review of driver."""
    row = await db.fetchrow(
        "SELECT id, request_id, mechanic_id, reviewer_id, rating, comment, direction, created_at FROM reviews WHERE request_id = $1 AND direction = $2",
        request_id, direction,
    )
    if not row:
        raise HTTPException(status_code=404, detail="No review found for this request")
    result = dict(row)
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    return result


@app.get("/mechanics/{mechanic_id}/reviews", tags=["Reviews"])
async def get_mechanic_reviews(
    mechanic_id: int,
    limit: int = 20,
    offset: int = 0,
    db=Depends(get_db),
):
    """
    List all reviews for a mechanic, newest first.
    Public endpoint — no auth required (ratings are public information).
    """
    rows = await db.fetch(
        """
        SELECT r.id, r.request_id, r.rating, r.comment, r.created_at,
               sr.customer_name, sr.service_type
        FROM reviews r
        JOIN service_requests sr ON sr.id = r.request_id
        WHERE r.mechanic_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
        """,
        mechanic_id, limit, offset,
    )
    total = await db.fetchval("SELECT COUNT(*) FROM reviews WHERE mechanic_id = $1", mechanic_id)
    avg = await db.fetchval("SELECT AVG(rating)::NUMERIC(3,2) FROM reviews WHERE mechanic_id = $1", mechanic_id)

    reviews = []
    for r in rows:
        rv = dict(r)
        if rv.get("created_at"):
            rv["created_at"] = rv["created_at"].isoformat()
        reviews.append(rv)

    return {
        "mechanic_id": mechanic_id,
        "total_reviews": total or 0,
        "average_rating": float(avg) if avg else None,
        "reviews": reviews,
    }


@app.get("/mechanics/{mechanic_id}/completed-jobs", tags=["Jobs"])
async def get_mechanic_completed_jobs(mechanic_id: int, limit: int = 200, db=Depends(get_db)):
    """A mechanic's completed jobs, newest first — powers Job History and the
    Today / This-Week dashboard stats. The data lives in the DB so admins can audit it."""
    rows = await db.fetch(
        """
        SELECT sr.id, sr.service_type, sr.customer_name, sr.location,
               sr.description, sr.status, sr.created_at, sr.completed_at,
               sr.en_route_at, sr.arrived_at, sr.service_started_at
        FROM service_requests sr
        WHERE sr.mechanic_id = $1 AND sr.status = 'completed'
        ORDER BY sr.completed_at DESC NULLS LAST
        LIMIT $2
        """,
        mechanic_id, limit,
    )
    jobs = []
    for r in rows:
        j = dict(r)
        for k in ("created_at", "completed_at", "en_route_at", "arrived_at", "service_started_at"):
            if j.get(k):
                j[k] = j[k].isoformat()
        jobs.append(j)
    return {"mechanic_id": mechanic_id, "total": len(jobs), "jobs": jobs}


# Jobs that count as "handled" once picked up. A request counts the moment the
# mechanic accepts it (accepted_at) and stays counted unless it is cancelled —
# so the dashboard's Today / This-Week totals tally from accepted_at, and a
# cancelled job drops out (taking the count back down). Stored in the DB so
# admins can audit it.
_HANDLED_STATUSES = (
    'accepted', 'en_route', 'arrived', 'service_started',
    'in_progress', 'awaiting_confirmation', 'completed',
)

@app.get("/mechanics/{mechanic_id}/handled-jobs", tags=["Jobs"])
async def get_mechanic_handled_jobs(mechanic_id: int, limit: int = 200, db=Depends(get_db)):
    """A mechanic's handled jobs — every request they have picked up (accepted
    onward) that has NOT been cancelled, newest pickup first. Powers the
    Today / This-Week counts, which tally from accepted_at."""
    rows = await db.fetch(
        """
        SELECT sr.id, sr.service_type, sr.customer_name, sr.location,
               sr.description, sr.status, sr.created_at, sr.accepted_at,
               sr.en_route_at, sr.arrived_at, sr.service_started_at, sr.completed_at
        FROM service_requests sr
        WHERE sr.mechanic_id = $1 AND sr.status = ANY($2::text[])
        ORDER BY sr.accepted_at DESC NULLS LAST
        LIMIT $3
        """,
        mechanic_id, list(_HANDLED_STATUSES), limit,
    )
    jobs = []
    for r in rows:
        j = dict(r)
        for k in ("created_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
            if j.get(k):
                j[k] = j[k].isoformat()
        jobs.append(j)
    return {"mechanic_id": mechanic_id, "total": len(jobs), "jobs": jobs}


@app.get("/mechanics/{mechanic_id}/job-history", tags=["Jobs"])
async def get_mechanic_job_history(mechanic_id: int, limit: int = 200, db=Depends(get_db)):
    """A mechanic's finished jobs — both COMPLETED and CANCELLED — newest first.
    Powers the Job History list (with cancel reasons for review)."""
    rows = await db.fetch(
        """
        SELECT sr.id, sr.service_type, sr.customer_name, sr.location,
               sr.description, sr.status, sr.created_at, sr.accepted_at,
               sr.en_route_at, sr.arrived_at, sr.service_started_at, sr.completed_at,
               sr.cancelled_by, sr.cancel_reason
        FROM service_requests sr
        WHERE sr.mechanic_id = $1 AND sr.status IN ('completed', 'cancelled')
        ORDER BY COALESCE(sr.completed_at, sr.created_at) DESC NULLS LAST
        LIMIT $2
        """, mechanic_id, limit)
    jobs = []
    for r in rows:
        j = dict(r)
        for k in ("created_at", "accepted_at", "en_route_at", "arrived_at", "service_started_at", "completed_at"):
            if j.get(k):
                j[k] = j[k].isoformat()
        jobs.append(j)
    return {"mechanic_id": mechanic_id, "total": len(jobs), "jobs": jobs}


# ════════════════════════════════ IN-JOB CHAT ════════════════════════════════
# Persisted, two-way chat between a driver and the mechanic on a request. Messages
# survive refresh, load as history, reach the other party even if they were
# offline, and broadcast live over the WebSocket. Each message is auto-"seen" by
# its sender; unread = the other party's messages this side hasn't opened yet.

class ChatSendIn(BaseModel):
    sender_role: str            # 'driver' | 'mechanic'
    sender_id: str = ""
    body: str = ""
    media_type: str = "none"    # 'none' | 'voice' | 'image'
    media_url: Optional[str] = None


def _chat_row_to_dict(r) -> dict:
    d = dict(r)
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


async def _broadcast_chat(msg: dict):
    try:
        await manager.broadcast({
            "type": "chat_message",
            "service_request_id": str(msg["request_id"]),
            "id": msg["id"],
            "sender_role": msg["sender_role"],
            "sender_id": msg["sender_id"],
            "message": msg.get("body", ""),       # legacy field name kept for existing listeners
            "media_type": msg.get("media_type", "none"),
            "media_url": msg.get("media_url"),
            "created_at": msg.get("created_at"),
        })
    except Exception as e:
        logger.warning(f"Failed to broadcast chat message: {e}")


async def _insert_chat(db, request_id: int, sender_role: str, sender_id: str,
                       body: str, media_type: str, media_url) -> dict:
    row = await db.fetchrow(
        """
        INSERT INTO chat_messages
            (request_id, sender_role, sender_id, body, media_type, media_url,
             seen_by_driver, seen_by_mechanic)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, request_id, sender_role, sender_id, body, media_type,
                  media_url, seen_by_driver, seen_by_mechanic, created_at
        """,
        request_id, sender_role, sender_id, body, media_type, media_url,
        sender_role == "driver", sender_role == "mechanic",
    )
    return _chat_row_to_dict(row)


@app.get("/requests/{request_id}/messages", tags=["Chat"])
async def list_messages(request_id: int, role: Optional[str] = None,
                        mark_seen: bool = False, db=Depends(get_db)):
    """Chat history for a request, oldest first. When mark_seen + role are given,
    the other party's messages are marked seen for that role (clears unread)."""
    if mark_seen and role in ("driver", "mechanic"):
        col = "seen_by_driver" if role == "driver" else "seen_by_mechanic"
        other = "mechanic" if role == "driver" else "driver"
        await db.execute(
            f"UPDATE chat_messages SET {col} = TRUE "
            f"WHERE request_id = $1 AND sender_role = $2 AND {col} = FALSE",
            request_id, other,
        )
    rows = await db.fetch(
        """
        SELECT id, request_id, sender_role, sender_id, body, media_type,
               media_url, seen_by_driver, seen_by_mechanic, created_at
        FROM chat_messages WHERE request_id = $1 ORDER BY created_at ASC, id ASC
        """,
        request_id,
    )
    return {"request_id": request_id, "messages": [_chat_row_to_dict(r) for r in rows]}


@app.get("/requests/{request_id}/messages/unread", tags=["Chat"])
async def unread_count(request_id: int, role: str, db=Depends(get_db)):
    """How many messages from the OTHER party this role hasn't seen yet."""
    if role not in ("driver", "mechanic"):
        return {"unread": 0}
    col = "seen_by_driver" if role == "driver" else "seen_by_mechanic"
    other = "mechanic" if role == "driver" else "driver"
    n = await db.fetchval(
        f"SELECT COUNT(*) FROM chat_messages "
        f"WHERE request_id = $1 AND sender_role = $2 AND {col} = FALSE",
        request_id, other,
    )
    return {"unread": int(n or 0)}


@app.post("/requests/{request_id}/messages/seen", tags=["Chat"])
async def mark_messages_seen(request_id: int, body: dict, db=Depends(get_db)):
    role = (body or {}).get("role")
    if role not in ("driver", "mechanic"):
        raise HTTPException(status_code=400, detail="role must be 'driver' or 'mechanic'")
    col = "seen_by_driver" if role == "driver" else "seen_by_mechanic"
    other = "mechanic" if role == "driver" else "driver"
    await db.execute(
        f"UPDATE chat_messages SET {col} = TRUE "
        f"WHERE request_id = $1 AND sender_role = $2 AND {col} = FALSE",
        request_id, other,
    )
    return {"unread": 0}


@app.post("/requests/{request_id}/messages", tags=["Chat"])
async def send_message(request_id: int, payload: ChatSendIn, db=Depends(get_db)):
    """Persist a text (or already-uploaded media) chat message and broadcast it."""
    role = payload.sender_role if payload.sender_role in ("driver", "mechanic") else "driver"
    if not (payload.body or "").strip() and not payload.media_url:
        raise HTTPException(status_code=400, detail="Message is empty")
    msg = await _insert_chat(db, request_id, role, payload.sender_id or "",
                             payload.body or "", payload.media_type or "none",
                             payload.media_url)
    await _broadcast_chat(msg)
    return msg


@app.post("/requests/{request_id}/messages/media", tags=["Chat"])
async def send_media_message(
    request_id: int,
    file: UploadFile = File(...),
    sender_role: str = Form(...),
    sender_id: str = Form(""),
    body: str = Form(""),
    db=Depends(get_db),
):
    """Upload a voice note or photo to storage, persist the message, broadcast it."""
    role = sender_role if sender_role in ("driver", "mechanic") else "driver"
    file_type = _get_file_type(file)                       # 'voice' | 'photo' | 'document'
    media_type = "voice" if file_type == "voice" else "image"
    suffix = Path(file.filename or "").suffix or (".webm" if media_type == "voice" else ".jpg")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            temp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not buffer upload: {e}")
    try:
        storage = get_storage()
        info = await storage.upload_file(temp_path, file_type, str(request_id))
        media_url = info["url"]
    except Exception as e:
        logger.error(f"Chat media upload failed: {e}")
        raise HTTPException(status_code=502, detail="Media upload failed")
    finally:
        Path(temp_path).unlink(missing_ok=True)
    msg = await _insert_chat(db, request_id, role, sender_id or "", body or "",
                             media_type, media_url)
    await _broadcast_chat(msg)
    return msg


# ════════════════════════════════ SPARE PARTS DEALER DIRECTORY ════════════════════════════════

import math as _math

class DealerCreate(BaseModel):
    name: str
    phone: str
    address: str = ""
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialty: str = ""
    description: str = ""
    verified: bool = False

class DealerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialty: Optional[str] = None
    description: Optional[str] = None
    verified: Optional[bool] = None
    active: Optional[bool] = None

class DealerOut(BaseModel):
    id: int
    name: str
    phone: str
    address: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    specialty: str
    description: str
    verified: bool
    active: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    distance_km: Optional[float] = None  # populated only when searching by proximity


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    R = 6371.0
    dlat = _math.radians(lat2 - lat1)
    dlon = _math.radians(lon2 - lon1)
    a = (_math.sin(dlat / 2) ** 2
         + _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2))
         * _math.sin(dlon / 2) ** 2)
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1 - a))


def _dealer_row_to_dict(row) -> dict:
    d = dict(row)
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    if d.get("updated_at"):
        d["updated_at"] = d["updated_at"].isoformat()
    d.setdefault("distance_km", None)
    return d


@app.get("/dealers", tags=["Spare Parts Dealers"])
async def list_dealers(
    specialty: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    db=Depends(get_db),
):
    """
    List all active spare parts dealers.
    - Filter by specialty (partial, case-insensitive)
    - Filter to verified dealers only
    No auth required — public lookup.
    """
    conditions = ["active = TRUE"]
    params: list = []

    if verified_only:
        conditions.append("verified = TRUE")

    if specialty:
        params.append(f"%{specialty}%")
        conditions.append(f"specialty ILIKE ${len(params)}")

    where = " AND ".join(conditions)
    params += [limit, offset]

    rows = await db.fetch(
        f"""
        SELECT id, name, phone, address, location, latitude, longitude,
               specialty, description, verified, active, created_at, updated_at
        FROM spare_parts_dealers
        WHERE {where}
        ORDER BY verified DESC, name ASC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )
    total = await db.fetchval(
        f"SELECT COUNT(*) FROM spare_parts_dealers WHERE {where}",
        *params[:-2],
    )
    return {
        "total": total or 0,
        "dealers": [_dealer_row_to_dict(r) for r in rows],
    }


@app.get("/dealers/search", tags=["Spare Parts Dealers"])
async def search_dealers_nearby(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    specialty: Optional[str] = None,
    verified_only: bool = False,
    db=Depends(get_db),
):
    """
    Find dealers within `radius_km` kilometres of a given coordinate.
    Results are sorted by distance (nearest first).
    No auth required.
    """
    conditions = ["active = TRUE", "latitude IS NOT NULL", "longitude IS NOT NULL"]
    params: list = []

    if verified_only:
        conditions.append("verified = TRUE")

    if specialty:
        params.append(f"%{specialty}%")
        conditions.append(f"specialty ILIKE ${len(params)}")

    where = " AND ".join(conditions)

    rows = await db.fetch(
        f"""
        SELECT id, name, phone, address, location, latitude, longitude,
               specialty, description, verified, active, created_at, updated_at
        FROM spare_parts_dealers
        WHERE {where}
        """,
        *params,
    )

    results = []
    for r in rows:
        dist = _haversine_km(lat, lon, r["latitude"], r["longitude"])
        if dist <= radius_km:
            d = _dealer_row_to_dict(r)
            d["distance_km"] = round(dist, 2)
            results.append(d)

    results.sort(key=lambda x: x["distance_km"])
    return {"total": len(results), "radius_km": radius_km, "dealers": results}


@app.get("/dealers/{dealer_id}", tags=["Spare Parts Dealers"])
async def get_dealer(dealer_id: int, db=Depends(get_db)):
    """Get a single spare parts dealer by ID. No auth required."""
    row = await db.fetchrow(
        """
        SELECT id, name, phone, address, location, latitude, longitude,
               specialty, description, verified, active, created_at, updated_at
        FROM spare_parts_dealers WHERE id = $1
        """,
        dealer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return _dealer_row_to_dict(row)


@app.post("/dealers", tags=["Spare Parts Dealers"], status_code=201)
async def create_dealer(
    body: DealerCreate,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Add a new spare parts dealer. Admin only."""
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    row = await db.fetchrow(
        """
        INSERT INTO spare_parts_dealers
            (name, phone, address, location, latitude, longitude,
             specialty, description, verified)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, name, phone, address, location, latitude, longitude,
                  specialty, description, verified, active, created_at, updated_at
        """,
        body.name, body.phone, body.address, body.location,
        body.latitude, body.longitude, body.specialty,
        body.description, body.verified,
    )
    return _dealer_row_to_dict(row)


@app.put("/dealers/{dealer_id}", tags=["Spare Parts Dealers"])
async def update_dealer(
    dealer_id: int,
    body: DealerUpdate,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update dealer details. Admin only."""
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.fetchrow(
        "SELECT id FROM spare_parts_dealers WHERE id = $1", dealer_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Dealer not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.utcnow()
    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())

    row = await db.fetchrow(
        f"""
        UPDATE spare_parts_dealers SET {set_clauses}
        WHERE id = $1
        RETURNING id, name, phone, address, location, latitude, longitude,
                  specialty, description, verified, active, created_at, updated_at
        """,
        dealer_id, *values,
    )
    return _dealer_row_to_dict(row)


@app.delete("/dealers/{dealer_id}", tags=["Spare Parts Dealers"])
async def delete_dealer(
    dealer_id: int,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Soft-delete a dealer (sets active=FALSE).
    Pass ?hard=true to permanently remove (admin only).
    """
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.fetchrow(
        "SELECT id FROM spare_parts_dealers WHERE id = $1", dealer_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Dealer not found")

    await db.execute(
        "UPDATE spare_parts_dealers SET active = FALSE, updated_at = NOW() WHERE id = $1",
        dealer_id,
    )
    return {"detail": "Dealer deactivated", "dealer_id": dealer_id}


# ────────────────────────────── GLOBAL EXCEPTION HANDLER ──────────────────────────────
# Catches and logs any unhandled exceptions to help with production debugging

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log all unhandled exceptions with request context"""
    print("🔥 UNHANDLED ERROR:", repr(exc))
    logger.exception(f"🔴 UNHANDLED EXCEPTION: {type(exc).__name__}")
    logger.error(f"   Path: {request.method} {request.url.path}")
    logger.error(f"   Origin: {request.headers.get('origin', 'NO ORIGIN')}")
    logger.error(f"   Details: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_type": type(exc).__name__}
    )

# ────────────────────────────── OPTIONAL STATIC / SPA FALLBACK ──────────────────────────────
# Same as in auth-service - allows serving a frontend bundle or SPA fallback if needed later
frontend_dir = os.getenv(
    "FRONTEND_DIST",
    str(Path(__file__).resolve().parents[1] / "frontend")
)
frontend_path = Path(frontend_dir)
index_file = frontend_path / "index.html"

if frontend_path.exists() and index_file.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(index_file)