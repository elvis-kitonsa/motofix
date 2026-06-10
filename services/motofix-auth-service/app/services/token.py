# app/services/token.py
# JWT creation, decoding, blacklisting.

import os
import hashlib
import logging
from datetime import datetime, timezone

from jose import jwt, JWTError, ExpiredSignatureError

from ..utils import create_jwt

logger = logging.getLogger(__name__)


# ── Token creation ─────────────────────────────────────────────────────────────

def create_access_token(data: dict, role: str) -> str:
    """Wrap utils.create_jwt with role-aware expiry."""
    payload = {**data, "role": role}
    return create_jwt(payload, role=role)


# ── Token decoding ─────────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Raises RuntimeError("TOKEN_EXPIRED") or RuntimeError("TOKEN_INVALID").
    """
    secret    = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM", "HS256")

    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        return payload
    except ExpiredSignatureError:
        raise RuntimeError("TOKEN_EXPIRED")
    except JWTError:
        raise RuntimeError("TOKEN_INVALID")


# ── Blacklist ──────────────────────────────────────────────────────────────────

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def blacklist_token(conn, token: str) -> None:
    """
    Store a SHA-256 hash of the token in token_blacklist.
    Silently ignores duplicate inserts.
    conn: raw asyncpg connection.
    """
    token_hash = _hash_token(token)
    try:
        await conn.execute(
            """
            INSERT INTO token_blacklist (token_hash, created_at)
            VALUES ($1, $2)
            ON CONFLICT (token_hash) DO NOTHING
            """,
            token_hash,
            datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.error("Failed to blacklist token: %s", exc)


async def is_blacklisted(conn, token: str) -> bool:
    """Return True if the token hash exists in token_blacklist."""
    token_hash = _hash_token(token)
    row = await conn.fetchrow(
        "SELECT id FROM token_blacklist WHERE token_hash = $1", token_hash
    )
    return row is not None
