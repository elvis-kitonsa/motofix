import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import asyncpg
import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

load_dotenv()

from .schemas import DispatchOutcome, MatchRequest, MatchResponse
from .scoring import rank_mechanics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "change_me_in_production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
MECHANICS_SERVICE_URL = os.getenv("MECHANICS_SERVICE_URL", "http://localhost:8002")

pool: Optional[asyncpg.Pool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    if DATABASE_URL:
        pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS dispatch_attempts (
                    id           SERIAL PRIMARY KEY,
                    request_id   INTEGER      NOT NULL,
                    mechanic_id  INTEGER      NOT NULL,
                    attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    outcome      VARCHAR(20)  NOT NULL DEFAULT 'pending',
                    UNIQUE (request_id, mechanic_id)
                )
            """)
        logger.info("Mechanic matching service: DB pool ready")
    else:
        logger.warning("DATABASE_URL not set — dispatch history tracking disabled")
    yield
    if pool:
        await pool.close()
        logger.info("Mechanic matching service: DB pool closed")


app = FastAPI(
    title="MOTOFIX - Intelligent Mechanic Matching Service",
    description=(
        "Ranks and selects the most suitable available verified service provider "
        "for each breakdown request using a weighted scoring algorithm that considers "
        "proximity, specialisation, star rating, and historical performance. "
        "Manages re-dispatch when a provider declines or fails to respond."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = [
    "https://customer.motofix.org",
    "https://admin.motofix.org",
    "https://motofix.org",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:8086",
    "http://localhost:8087",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
    "http://192.168.1.3:8080",
    "http://192.168.1.3:5173",
    "http://192.168.1.3:3000",
    "http://192.168.1.3:8083",
    "http://192.168.1.3:8084",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _require_token(authorization: str = Header(...)) -> dict:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "mechanic-matching"}


@app.post("/match", response_model=MatchResponse, tags=["matching"])
async def match_mechanics(
    body: MatchRequest,
    _user: dict = Depends(_require_token),
):
    """
    Find the best available mechanics for a breakdown request.

    Fetches verified + available mechanics from the Mechanic Verification Service,
    scores each one using the weighted algorithm, excludes any mechanics who have
    already declined or timed out on this request, and returns the top candidates.
    """
    # Build exclusion list from manual override + DB history
    excluded_ids: List[int] = list(body.excluded_mechanic_ids or [])
    if pool and body.request_id:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT mechanic_id FROM dispatch_attempts
                   WHERE request_id = $1 AND outcome IN ('declined', 'expired')""",
                body.request_id,
            )
            excluded_ids.extend(r["mechanic_id"] for r in rows)

    # Fetch verified mechanics from the Mechanic Verification Service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{MECHANICS_SERVICE_URL}/mechanics",
                params={"verified_only": "true", "available_only": "true"},
                timeout=10.0,
            )
            resp.raise_for_status()
            payload = resp.json()
            mechanics = payload if isinstance(payload, list) else payload.get("mechanics", [])
        except Exception as exc:
            logger.error("Failed to reach Mechanic Verification Service: %s", exc)
            raise HTTPException(
                status_code=503,
                detail=f"Could not reach Mechanic Verification Service: {exc}",
            )

    ranked = rank_mechanics(
        mechanics=mechanics,
        request_lat=body.latitude,
        request_lon=body.longitude,
        service_type=body.service_type,
        excluded_ids=excluded_ids,
        top_n=body.top_n or 5,
    )

    if not ranked:
        raise HTTPException(
            status_code=404,
            detail="No eligible mechanics found within range for this request.",
        )

    # Record these mechanics as 'pending' dispatch attempts
    if pool and body.request_id:
        async with pool.acquire() as conn:
            for candidate in ranked:
                await conn.execute(
                    """INSERT INTO dispatch_attempts (request_id, mechanic_id, outcome)
                       VALUES ($1, $2, 'pending')
                       ON CONFLICT (request_id, mechanic_id) DO NOTHING""",
                    body.request_id,
                    candidate["mechanic_id"],
                )

    return MatchResponse(
        request_id=body.request_id,
        candidates=ranked,
        total_eligible=len(ranked),
    )


@app.post("/dispatch/{request_id}/outcome", tags=["dispatch"])
async def record_outcome(
    request_id: int,
    body: DispatchOutcome,
    _user: dict = Depends(_require_token),
):
    """
    Record the outcome of a dispatch attempt (accepted / declined / expired).

    Called by the Request and Dispatch Management Service after a mechanic
    responds — or fails to respond within the time window. A 'declined' or
    'expired' outcome triggers the caller to re-invoke POST /match, which will
    automatically exclude mechanics already recorded here.
    """
    if not pool:
        raise HTTPException(status_code=503, detail="Database not configured — set DATABASE_URL")
    if body.outcome not in ("accepted", "declined", "expired"):
        raise HTTPException(status_code=422, detail="outcome must be one of: accepted, declined, expired")

    async with pool.acquire() as conn:
        result = await conn.execute(
            """UPDATE dispatch_attempts SET outcome = $1
               WHERE request_id = $2 AND mechanic_id = $3""",
            body.outcome,
            request_id,
            body.mechanic_id,
        )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="No matching dispatch attempt found")

    logger.info(
        "Dispatch outcome recorded: request=%s mechanic=%s outcome=%s",
        request_id,
        body.mechanic_id,
        body.outcome,
    )
    return {
        "message": f"Outcome '{body.outcome}' recorded for mechanic {body.mechanic_id} on request {request_id}"
    }


@app.get("/dispatch/{request_id}/history", tags=["dispatch"])
async def dispatch_history(
    request_id: int,
    _user: dict = Depends(_require_token),
):
    """Return the full dispatch attempt history for a request (for audit / re-dispatch logic)."""
    if not pool:
        raise HTTPException(status_code=503, detail="Database not configured — set DATABASE_URL")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT mechanic_id, attempted_at, outcome
               FROM dispatch_attempts
               WHERE request_id = $1
               ORDER BY attempted_at""",
            request_id,
        )

    return {
        "request_id": request_id,
        "attempts": [dict(r) for r in rows],
    }
