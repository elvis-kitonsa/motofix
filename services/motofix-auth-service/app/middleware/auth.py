# app/middleware/auth.py
# Shared auth middleware — imported by ALL other MOTOFIX services.
#
# This is the "doorman" for protected endpoints. When a logged-in user makes a
# request, their app sends a token (a JWT — a signed string proving who they are).
# The two tools here check that token:
#   • get_current_user — confirms the token is real, not expired, and not revoked,
#                        then returns who the user is.
#   • require_role     — additionally checks the user is allowed (e.g. admins only).
# A token can be "blacklisted" when someone logs out, so an old token can't be reused.
#
# Self-contained: only depends on python-jose, python-dotenv, and asyncpg.
# Other services copy this file OR install motofix-auth-service as a package.
#
# Usage in any service:
#   from app.middleware.auth import get_current_user, require_role
#
#   @router.get("/protected")
#   async def endpoint(user=Depends(get_current_user)):
#       ...
#
#   @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
#   async def admin_endpoint():
#       ...

import os
import hashlib
import logging
from typing import Callable

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login/provider", auto_error=False)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_token_from_request(request: Request, header_token: str | None) -> str | None:
    """Prefer Authorization header, fall back to httpOnly cookie."""
    if header_token:
        return header_token
    return request.cookies.get("access_token")


def _decode_token(token: str) -> dict:
    secret    = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM", "HS256")
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": True, "code": "TOKEN_EXPIRED",
                    "message": "Token has expired", "status_code": 401},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": True, "code": "TOKEN_INVALID",
                    "message": "Invalid token", "status_code": 401},
        )


async def _check_blacklist(conn, token: str) -> None:
    """Raise 401 if the token has been blacklisted."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = await conn.fetchrow(
        "SELECT id FROM token_blacklist WHERE token_hash = $1", token_hash
    )
    if row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": True, "code": "TOKEN_INVALID",
                    "message": "Token has been revoked", "status_code": 401},
        )


# ── get_current_user ───────────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    header_token: str | None = Depends(oauth2_scheme),
) -> dict:
    """
    FastAPI dependency.
    Decodes the JWT from Authorization header or httpOnly cookie.
    Checks the token blacklist via the asyncpg pool on the app state.
    Returns the token payload dict: { sub, role, phone/email, exp, iat }.
    """
    token = _get_token_from_request(request, header_token)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": True, "code": "TOKEN_INVALID",
                    "message": "Not authenticated", "status_code": 401},
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(token)

    # Check blacklist using the app's asyncpg pool (set in main.py lifespan)
    pool = getattr(request.app.state, "pool", None)
    if pool:
        try:
            async with pool.acquire() as conn:
                await _check_blacklist(conn, token)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Blacklist check failed (non-fatal): %s", exc)

    return payload


# ── require_role ───────────────────────────────────────────────────────────────

def require_role(*roles: str) -> Callable:
    """
    Returns a FastAPI dependency that enforces role-based access.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("admin"))])
        @router.get("/mechanic", dependencies=[Depends(require_role("mechanic", "towing_provider"))])
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": True,
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": f"Access restricted to: {', '.join(roles)}",
                    "status_code": 403,
                },
            )
        return user

    return role_checker
