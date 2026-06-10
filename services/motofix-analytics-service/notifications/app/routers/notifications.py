"""
motofix-notifications: notifications router
- SMS via Africa's Talking
- WhatsApp via Africa's Talking
- Push notifications via Firebase Cloud Messaging (FCM HTTP v1 API)
- Notification persistence in the `notifications` DB table
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import asyncpg
import httpx
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notify", tags=["Notifications"])

# ─────────────────────────── Africa's Talking SMS ───────────────────────────

try:
    import africastalking
    AT_USERNAME = os.getenv("AT_USERNAME", "sandbox")
    AT_API_KEY = os.getenv("AT_API_KEY", "")
    if AT_API_KEY:
        africastalking.initialize(AT_USERNAME, AT_API_KEY)
        _sms = africastalking.SMS
        AT_READY = True
    else:
        AT_READY = False
except Exception as e:
    logger.warning("Africa's Talking not available: %s", e)
    AT_READY = False
    _sms = None

# ─────────────────────────── DB (shared pool) ────────────────────────────────

_db_pool: Optional[asyncpg.Pool] = None

CREATE_NOTIFICATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    channel     TEXT NOT NULL,          -- 'sms', 'whatsapp', 'push'
    recipient   TEXT NOT NULL,          -- phone or FCM device token
    message     TEXT NOT NULL,
    title       TEXT,                   -- push only
    status      TEXT NOT NULL DEFAULT 'sent',
    provider_response TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


async def get_db_pool() -> Optional[asyncpg.Pool]:
    """Lazy-init shared DB pool for notification persistence."""
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return None
    try:
        _db_pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5)
        async with _db_pool.acquire() as conn:
            await conn.execute(CREATE_NOTIFICATIONS_TABLE)
        logger.info("✅ Notifications DB pool ready")
    except Exception as e:
        logger.warning("⚠️  Notifications DB pool failed (non-fatal): %s", e)
        _db_pool = None
    return _db_pool


async def _persist(channel: str, recipient: str, message: str,
                   title: Optional[str], status: str, provider_response: str):
    """Write notification record to DB (best-effort, non-blocking)."""
    pool = await get_db_pool()
    if not pool:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO notifications
                  (channel, recipient, message, title, status, provider_response)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                channel, recipient, message, title, status, provider_response,
            )
    except Exception as e:
        logger.warning("⚠️  Could not persist notification: %s", e)


# ─────────────────────────── FCM helper ──────────────────────────────────────

FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "")
_FCM_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")


def _get_fcm_service_account() -> Optional[dict]:
    """Parse FCM service account JSON from environment variable."""
    raw = _FCM_SERVICE_ACCOUNT_JSON.strip()
    if not raw:
        return None
    # May be a file path or inline JSON string
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except Exception:
            return None
    if os.path.isfile(raw):
        try:
            with open(raw) as f:
                return json.load(f)
        except Exception:
            return None
    return None


async def _get_fcm_access_token(service_account: dict) -> str:
    """
    Exchange a Google service account for a short-lived OAuth2 bearer token
    using the google-auth library (if available) or a manual JWT grant flow.
    """
    try:
        import google.auth.transport.requests as google_requests
        from google.oauth2 import service_account as google_sa

        credentials = google_sa.Credentials.from_service_account_info(
            service_account,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        credentials.refresh(google_requests.Request())
        return credentials.token
    except ImportError:
        pass  # fall through to manual JWT grant

    # Manual JWT grant — requires only PyJWT (jose) which is already installed
    import time
    from jose import jwt as jose_jwt

    now = int(time.time())
    claims = {
        "iss": service_account["client_email"],
        "sub": service_account["client_email"],
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
        "scope": "https://www.googleapis.com/auth/firebase.messaging",
    }
    private_key = service_account["private_key"]
    kid = service_account.get("private_key_id", "")
    signed_jwt = jose_jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": kid})

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": signed_jwt,
            },
        )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def _send_fcm_push(token: str, title: str, body: str, data: dict = None) -> dict:
    """Send a push notification via FCM HTTP v1 API."""
    service_account = _get_fcm_service_account()
    project_id = FCM_PROJECT_ID

    if not service_account and not project_id:
        logger.warning("⚠️  FCM not configured — FIREBASE_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID not set")
        return {"status": "skipped", "reason": "FCM not configured"}

    if service_account and not project_id:
        project_id = service_account.get("project_id", "")

    if not project_id:
        return {"status": "error", "reason": "FCM_PROJECT_ID could not be determined"}

    try:
        access_token = await _get_fcm_access_token(service_account)
    except Exception as e:
        logger.error("Failed to get FCM access token: %s", e)
        raise HTTPException(status_code=502, detail=f"FCM auth failed: {e}")

    message_payload: dict = {
        "token": token,
        "notification": {"title": title, "body": body},
    }
    if data:
        # FCM data payloads must be string→string maps
        message_payload["data"] = {k: str(v) for k, v in data.items()}

    payload = {"message": message_payload}

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )

    logger.info("FCM response: status=%s body=%s", resp.status_code, resp.text)

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"FCM rejected the request: {resp.status_code} {resp.text}",
        )

    return resp.json()


# ─────────────────────────── Request/Response models ─────────────────────────

class SmsRequest(BaseModel):
    to: str
    message: str


class WhatsAppRequest(BaseModel):
    to: str
    message: str


class PushRequest(BaseModel):
    device_token: str
    title: str
    body: str
    data: Optional[dict] = None          # arbitrary key→value for the app to consume


class BulkPushRequest(BaseModel):
    """Send the same push notification to multiple device tokens."""
    device_tokens: list[str]
    title: str
    body: str
    data: Optional[dict] = None


class NotificationListOut(BaseModel):
    id: int
    channel: str
    recipient: str
    message: str
    title: Optional[str]
    status: str
    provider_response: Optional[str]
    created_at: Optional[str]


# ─────────────────────────── Endpoints ───────────────────────────────────────

@router.post("/sms")
async def send_sms(req: SmsRequest, background_tasks: BackgroundTasks):
    """Send an SMS via Africa's Talking and persist the record."""
    status = "sent"
    provider_response = ""

    if not AT_READY:
        status = "skipped"
        provider_response = "Africa's Talking not configured"
        logger.warning("SMS not sent (AT not configured): to=%s", req.to)
        result = {"status": status, "to": req.to, "note": provider_response}
    else:
        try:
            response = _sms.send(req.message, [req.to])
            provider_response = json.dumps(response)
            logger.info("SMS sent: to=%s", req.to)
            result = {"status": "sent", "provider": "SMS", "response": response}
        except Exception as e:
            status = "failed"
            provider_response = str(e)
            raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(
        _persist, "sms", req.to, req.message, None, status, provider_response
    )
    return result


@router.post("/whatsapp")
async def send_whatsapp(req: WhatsAppRequest, background_tasks: BackgroundTasks):
    """Send a WhatsApp message via Africa's Talking and persist the record."""
    status = "sent"
    provider_response = ""

    if not AT_READY:
        status = "skipped"
        provider_response = "Africa's Talking not configured"
        result = {"status": status, "to": req.to, "note": provider_response}
    else:
        try:
            _wa = africastalking.WhatsApp
            response = _wa.send(message=req.message, recipients=[req.to])
            provider_response = json.dumps(response)
            result = {"status": "sent", "provider": "WhatsApp", "response": response}
        except Exception as e:
            status = "failed"
            provider_response = str(e)
            raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(
        _persist, "whatsapp", req.to, req.message, None, status, provider_response
    )
    return result


@router.post("/push")
async def send_push(req: PushRequest, background_tasks: BackgroundTasks):
    """
    Send a Firebase Cloud Messaging (FCM) push notification to a single device.
    Requires FIREBASE_SERVICE_ACCOUNT_JSON and FCM_PROJECT_ID to be set in the environment.
    """
    try:
        fcm_result = await _send_fcm_push(
            token=req.device_token,
            title=req.title,
            body=req.body,
            data=req.data,
        )
        status = "sent" if fcm_result.get("name") else fcm_result.get("status", "sent")
        provider_response = json.dumps(fcm_result)
        background_tasks.add_task(
            _persist, "push", req.device_token, req.body, req.title, status, provider_response
        )
        return {"status": status, "fcm_response": fcm_result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Push notification failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push/bulk")
async def send_bulk_push(req: BulkPushRequest, background_tasks: BackgroundTasks):
    """
    Send a push notification to multiple device tokens.
    Each token gets an individual FCM request (FCM recommends per-token targeting).
    Returns a summary with per-token outcomes.
    """
    results = []
    for token in req.device_tokens:
        try:
            fcm_result = await _send_fcm_push(
                token=token,
                title=req.title,
                body=req.body,
                data=req.data,
            )
            status = "sent"
            provider_response = json.dumps(fcm_result)
        except Exception as e:
            status = "failed"
            provider_response = str(e)
            fcm_result = {"error": str(e)}

        background_tasks.add_task(
            _persist, "push", token, req.body, req.title, status, provider_response
        )
        results.append({"token": token[:20] + "…", "status": status})

    sent = sum(1 for r in results if r["status"] == "sent")
    return {
        "total": len(req.device_tokens),
        "sent": sent,
        "failed": len(req.device_tokens) - sent,
        "results": results,
    }


@router.get("/history")
async def notification_history(
    channel: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List recent notification records (for admin dashboard)."""
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not configured")

    async with pool.acquire() as conn:
        conditions = []
        params: list = []
        if channel:
            conditions.append(f"channel = ${len(params)+1}")
            params.append(channel)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        total = await conn.fetchval(f"SELECT COUNT(*) FROM notifications {where}", *params)
        rows = await conn.fetch(
            f"""
            SELECT id, channel, recipient, message, title, status, provider_response, created_at
            FROM notifications {where}
            ORDER BY created_at DESC
            LIMIT ${len(params)+1} OFFSET ${len(params)+2}
            """,
            *params, limit, offset,
        )

    notifications = []
    for r in rows:
        n = dict(r)
        if n.get("created_at"):
            n["created_at"] = n["created_at"].isoformat()
        notifications.append(n)

    return {"total": total or 0, "limit": limit, "offset": offset, "notifications": notifications}
