# app/routers/applications.py
# Provider application submission, admin review, approve / reject.

import os
import re
import uuid
import base64
import json
import random
import string
import logging
from datetime import datetime, timezone, date

import bcrypt
import httpx
from fastapi import (
    APIRouter, Depends, HTTPException, Request,
    UploadFile, File, Form, status,
)
from pydantic import BaseModel
from typing import List, Optional

from app.middleware.auth import get_current_user, require_role
from app.services.logger import log_event
from app.services.sms import send_sms

# ── AI verification constants ─────────────────────────────────────────────────

_ANT_URL     = "https://api.anthropic.com/v1/messages"
_ANT_MODEL   = "claude-sonnet-4-6"
_ANT_VERSION = "2023-06-01"
_MIME_MAP    = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png",  "webp": "image/webp", "gif": "image/gif"}

_COMPREHENSIVE_PROMPT = """You are a document verification specialist for MOTOFIX, a roadside assistance platform in Uganda.
Analyze the submitted documents for a service provider application.
The applicant's registered name is: "{expected_name}"

Documents provided in this message (in order): {docs_list}

Carefully examine each document image and return ONLY valid JSON — no markdown, no explanation:
{{
  "national_id": {{
    "present": true or false,
    "appears_genuine": true or false or null,
    "quality": "good" or "poor" or "unreadable",
    "quality_issues": [],
    "tampering_detected": false,
    "extracted": {{
      "name": null,
      "id_number": null,
      "date_of_birth": "YYYY-MM-DD or null",
      "expiry_date": "YYYY-MM-DD or null",
      "issuing_authority": null
    }}
  }},
  "certification": {{
    "present": true or false,
    "appears_genuine": true or false or null,
    "quality": "good" or "poor" or "unreadable",
    "quality_issues": [],
    "extracted": {{
      "name": null,
      "certification_type": null,
      "issue_date": "YYYY-MM-DD or null",
      "expiry_date": "YYYY-MM-DD or null",
      "issuing_body": null
    }}
  }},
  "profile_photo": {{
    "present": true or false,
    "quality": "good" or "poor" or "unreadable",
    "quality_issues": [],
    "is_real_person": true or false or null
  }},
  "cross_checks": {{
    "all_names_consistent": true or false or null,
    "name_matches_application": true or false or null,
    "dob_consistent": true or false or null,
    "discrepancies": []
  }},
  "overall": {{
    "recommendation": "approve" or "reject" or "reupload_needed",
    "rejection_reasons": [],
    "reupload_documents": [],
    "flags": [],
    "summary": "one sentence"
  }}
}}

Rules:
- If quality is "unreadable" for national_id or certification → recommendation = "reupload_needed", add document name to reupload_documents
- If names across documents don't match each other or the expected name → add "NAME_MISMATCH" to flags, recommendation = "reject"
- If tampering is detected on any document → add "TAMPERING_DETECTED" to flags, recommendation = "reject"
- For profile photo: just assess whether it's a real, clear photo of a person
- Be conservative: prefer "reupload_needed" over "reject" when the only issue is image quality"""


def _normalize_id(raw: str) -> str:
    """Strip spaces/hyphens and uppercase — used for duplicate detection."""
    return re.sub(r"[\s\-]", "", raw.upper())


def _load_image(url: str) -> tuple[bytes, str]:
    """Read a file stored at a /uploads/... URL. Returns (bytes, mime_type)."""
    rel = url.lstrip("/")
    ext = rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
    mime = _MIME_MAP.get(ext, "image/jpeg")
    with open(rel, "rb") as fh:
        return fh.read(), mime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/providers", tags=["Provider Applications"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
    return pool


async def _save_file(file: UploadFile | None, subfolder: str) -> str | None:
    if not file or not file.filename:
        return None
    ext = os.path.splitext(file.filename or "")[1] or ""
    filename = f"{uuid.uuid4().hex}{ext}"
    dir_path = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(dir_path, exist_ok=True)
    content = await file.read()
    with open(os.path.join(dir_path, filename), "wb") as f:
        f.write(content)
    return f"/uploads/{subfolder}/{filename}"


def _gen_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ── POST /providers/applications ──────────────────────────────────────────────
# Public — no auth required. Providers submit before they have an account.

@router.post("/applications", status_code=status.HTTP_201_CREATED)
async def submit_application(
    request:             Request,
    # ── Required fields ──
    full_name:           str = Form(...),
    phone:               str = Form(...),
    provider_type:       str = Form(...),   # 'mechanic' | 'towing_provider'
    # ── Optional text fields ──
    email:               str = Form(None),
    specializations:     str = Form(None),
    service_area:        str = Form(None),
    years_experience:    str = Form(None),
    business_name:       str = Form(None),
    business_reg_number: str = Form(None),
    business_address:    str = Form(None),
    mobile_money_number: str = Form(None),
    garage_affiliation:  str = Form(None),
    referral_name:       str = Form(None),
    referral_phone:      str = Form(None),
    # ── Files ──
    face_scan:           UploadFile = File(None),
    national_id:         UploadFile = File(None),
    certification:       UploadFile = File(None),
    profile_photo:       UploadFile = File(None),
):
    pool = await _get_pool(request)
    slug = uuid.uuid4().hex[:10]

    face_scan_url     = await _save_file(face_scan,     f"applications/{slug}")
    national_id_url   = await _save_file(national_id,   f"applications/{slug}")
    certification_url = await _save_file(certification, f"applications/{slug}")
    profile_photo_url = await _save_file(profile_photo, f"applications/{slug}")

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, verification_status FROM provider_applications WHERE phone=$1 AND verification_status IN ('pending','needs_reupload')",
            phone,
        )
        if existing:
            if existing["verification_status"] == "needs_reupload":
                # Admin requested specific docs to be re-uploaded — update only the
                # newly provided files and reset to pending.
                await conn.execute(
                    """
                    UPDATE provider_applications
                    SET national_id_url       = COALESCE($1, national_id_url),
                        certification_url     = COALESCE($2, certification_url),
                        profile_photo_url     = COALESCE($3, profile_photo_url),
                        face_scan_url         = COALESCE($4, face_scan_url),
                        verification_status   = 'pending',
                        reupload_requested_docs = NULL,
                        reupload_requested_at   = NULL,
                        reviewed_at             = NULL,
                        reviewed_by             = NULL
                    WHERE id = $5
                    """,
                    national_id_url, certification_url, profile_photo_url,
                    face_scan_url, existing["id"],
                )
                logger.info("📎 Re-upload for application #%s from %s", existing["id"], phone)
                return {"success": True, "application_id": existing["id"],
                        "message": "Documents updated. Your application is back under review."}
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error": True, "code": "APPLICATION_EXISTS",
                            "message": "A pending application for this phone already exists"},
                )

        row = await conn.fetchrow(
            """
            INSERT INTO provider_applications
                (full_name, phone, email, provider_type, specializations, service_area,
                 years_experience, business_name, business_reg_number, business_address,
                 mobile_money_number, garage_affiliation, referral_name, referral_phone,
                 face_scan_url, national_id_url, certification_url, profile_photo_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING id
            """,
            full_name, phone, email, provider_type, specializations, service_area,
            years_experience, business_name, business_reg_number, business_address,
            mobile_money_number, garage_affiliation, referral_name, referral_phone,
            face_scan_url, national_id_url, certification_url, profile_photo_url,
        )

    logger.info("📋 New application #%s from %s (%s)", row["id"], full_name, phone)
    return {"success": True, "application_id": row["id"],
            "message": "Application submitted. You will be notified via SMS once reviewed."}


# ── GET /providers/applications/status?phone= ─────────────────────────────────
# Public — lets a provider check their application status without being logged in.

@router.get("/applications/status")
async def check_status(request: Request, phone: str):
    pool = await _get_pool(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT verification_status, rejection_reason, submitted_at
            FROM provider_applications
            WHERE phone = $1
            ORDER BY submitted_at DESC LIMIT 1
            """,
            phone,
        )
    if not row:
        raise HTTPException(status_code=404, detail="No application found for this phone")
    return dict(row)


# ── GET /providers/applications ───────────────────────────────────────────────

@router.get("/applications", dependencies=[Depends(require_role("admin"))])
async def list_applications(request: Request, status: str = None):
    pool = await _get_pool(request)
    async with pool.acquire() as conn:
        if status and status != "all":
            rows = await conn.fetch(
                """
                SELECT id, full_name, phone, email, provider_type, service_area,
                       verification_status, submitted_at, reviewed_at
                FROM provider_applications
                WHERE verification_status = $1
                ORDER BY submitted_at DESC
                """,
                status,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, full_name, phone, email, provider_type, service_area,
                       verification_status, submitted_at, reviewed_at
                FROM provider_applications
                ORDER BY submitted_at DESC
                """,
            )
    return [dict(r) for r in rows]


# ── GET /providers/applications/{id} ─────────────────────────────────────────

@router.get("/applications/{application_id}", dependencies=[Depends(require_role("admin"))])
async def get_application(application_id: int, request: Request):
    pool = await _get_pool(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM provider_applications WHERE id = $1", application_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    return dict(row)


# ── POST /providers/applications/{id}/approve ─────────────────────────────────

@router.post("/applications/{application_id}/approve",
             dependencies=[Depends(require_role("admin"))])
async def approve_application(
    application_id: int,
    request:        Request,
    admin:          dict = Depends(require_role("admin")),
):
    pool = await _get_pool(request)

    async with pool.acquire() as conn:
        app_row = await conn.fetchrow(
            "SELECT * FROM provider_applications WHERE id = $1", application_id,
        )
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if app_row["verification_status"] != "pending":
            raise HTTPException(status_code=400, detail="Application is not pending")

        data = dict(app_row)
        password = _gen_password()
        pw_hash  = _hash_pw(password)
        now      = datetime.now(timezone.utc)

        # Create or update provider account
        if data["provider_type"] == "mechanic":
            existing = await conn.fetchrow(
                "SELECT id, spn FROM mechanics WHERE phone = $1", data["phone"],
            )
            if existing:
                await conn.execute(
                    "UPDATE mechanics SET password_hash=$1, is_verified=TRUE, full_name=$2 WHERE phone=$3",
                    pw_hash, data["full_name"], data["phone"],
                )
                provider_id = existing["id"]
                spn = existing["spn"]
            else:
                provider_id = await conn.fetchval(
                    """
                    INSERT INTO mechanics
                        (full_name, phone, location, latitude, longitude, specialty,
                         provider_type, password_hash, is_verified, is_available, created_at)
                    VALUES ($1,$2,$3,0,0,$4,'mechanic',$5,TRUE,FALSE,$6)
                    RETURNING id
                    """,
                    data["full_name"], data["phone"],
                    data.get("service_area") or "Uganda",
                    data.get("specializations"),
                    pw_hash, now,
                )
                spn = None
        else:  # towing_provider
            existing = await conn.fetchrow(
                "SELECT id, spn FROM towing_providers WHERE phone = $1", data["phone"],
            )
            if existing:
                await conn.execute(
                    "UPDATE towing_providers SET password_hash=$1, is_verified=TRUE, full_name=$2 WHERE phone=$3",
                    pw_hash, data["full_name"], data["phone"],
                )
                provider_id = existing["id"]
                spn = existing["spn"]
            else:
                provider_id = await conn.fetchval(
                    """
                    INSERT INTO towing_providers
                        (full_name, phone, location, latitude, longitude,
                         password_hash, is_verified, is_available, created_at)
                    VALUES ($1,$2,$3,0,0,$4,TRUE,FALSE,$5)
                    RETURNING id
                    """,
                    data["full_name"], data["phone"],
                    data.get("service_area") or "Uganda",
                    pw_hash, now,
                )
                spn = None

        # Assign SPN if the provider doesn't have one yet
        if not spn:
            spn_num = await conn.fetchval("SELECT nextval('spn_seq')")
            spn = f"SPN-{spn_num:04d}"
            table = "mechanics" if data["provider_type"] == "mechanic" else "towing_providers"
            await conn.execute(f"UPDATE {table} SET spn = $1 WHERE id = $2", spn, provider_id)

        # Mark application approved
        await conn.execute(
            """
            UPDATE provider_applications
            SET verification_status='approved', reviewed_at=$1, reviewed_by=$2
            WHERE id=$3
            """,
            now, int(admin.get("sub", 0)), application_id,
        )

        await log_event(
            conn, event_type="provider_approved",
            description=f"Admin {admin.get('sub')} approved application #{application_id} ({data['phone']})",
        )

    # Send credentials via SMS
    sms_body = (
        f"MOTOFIX: Your provider account is approved!\n"
        f"Provider ID: {spn}\n"
        f"Password: {password}\n"
        f"Use these to log in at the Provider Dashboard."
    )
    try:
        send_sms(data["phone"], sms_body)
    except Exception as exc:
        logger.warning("SMS send failed (non-fatal): %s", exc)

    logger.info("✅ Approved #%s — %s, SPN: %s, password: %s", application_id, data["phone"], spn, password)
    return {"success": True, "message": "Application approved. Credentials sent via SMS."}


# ── POST /providers/applications/{id}/reject ──────────────────────────────────

@router.post("/applications/{application_id}/reject",
             dependencies=[Depends(require_role("admin"))])
async def reject_application(
    application_id: int,
    request:        Request,
    admin:          dict = Depends(require_role("admin")),
):
    body   = await request.json()
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Rejection reason is required")

    pool = await _get_pool(request)
    now  = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE provider_applications
            SET verification_status='rejected', rejection_reason=$1,
                reviewed_at=$2, reviewed_by=$3
            WHERE id=$4 AND verification_status='pending'
            """,
            reason, now, int(admin.get("sub", 0)), application_id,
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Application not found or not pending")

        await log_event(
            conn, event_type="provider_rejected",
            description=f"Admin {admin.get('sub')} rejected #{application_id}: {reason[:80]}",
        )

        rejected_phone = await conn.fetchval(
            "SELECT phone FROM provider_applications WHERE id = $1", application_id,
        )

    if rejected_phone:
        sms_body = (
            f"MOTOFIX: Your provider application was not approved.\n"
            f"Reason: {reason}\n"
            f"For assistance, contact support@motofix.ug."
        )
        try:
            send_sms(rejected_phone, sms_body)
        except Exception as exc:
            logger.warning("SMS send failed (non-fatal): %s", exc)

    return {"success": True, "message": "Application rejected."}


# ── POST /providers/applications/{id}/reopen ──────────────────────────────────

@router.post("/applications/{application_id}/reopen",
             dependencies=[Depends(require_role("admin"))])
async def reopen_application(
    application_id: int,
    request:        Request,
    admin:          dict = Depends(require_role("admin")),
):
    """Reset a rejected application back to pending so it can be approved."""
    pool = await _get_pool(request)
    now  = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE provider_applications
            SET verification_status = 'pending',
                rejection_reason    = NULL,
                reviewed_at         = NULL,
                reviewed_by         = NULL
            WHERE id = $1 AND verification_status = 'rejected'
            """,
            application_id,
        )
        if result == "UPDATE 0":
            raise HTTPException(
                status_code=404,
                detail="Application not found or is not in a rejected state",
            )
        await log_event(
            conn, event_type="application_reopened",
            description=f"Admin {admin.get('sub')} re-opened application #{application_id} for review",
        )

    return {"success": True, "message": "Application has been re-opened for review."}


# ── POST /providers/applications/{id}/verify ─────────────────────────────────
# Comprehensive AI check: all docs, cross-checks, expiry, duplicate ID.

@router.post("/applications/{application_id}/verify",
             dependencies=[Depends(require_role("admin"))])
async def verify_application_documents(
    application_id: int,
    request: Request,
):
    """Run a full AI verification pass on all documents for an application."""
    pool = await _get_pool(request)

    async with pool.acquire() as conn:
        app_row = await conn.fetchrow(
            "SELECT * FROM provider_applications WHERE id = $1", application_id
        )
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    data = dict(app_row)
    expected_name = data.get("full_name") or ""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    # Build Claude message — include every available document
    content_blocks: list = []
    docs_list_labels: list[str] = []
    missing_docs: list[str] = []

    for url_field, label in [
        ("national_id_url",    "National ID / Driving Licence"),
        ("certification_url",  "Professional Certification"),
        ("profile_photo_url",  "Profile Photo"),
    ]:
        url = data.get(url_field)
        if not url:
            missing_docs.append(label)
            continue
        try:
            raw_bytes, mime = _load_image(url)
            content_blocks.append({
                "type": "image",
                "source": {"type": "base64", "media_type": mime,
                           "data": base64.b64encode(raw_bytes).decode()},
            })
            content_blocks.append({"type": "text", "text": f"[Document: {label}]"})
            docs_list_labels.append(label)
        except (FileNotFoundError, OSError):
            missing_docs.append(label)

    # If no documents found at all, return early without calling Claude
    if not content_blocks:
        return {
            "national_id": {"present": False, "appears_genuine": None, "quality": "unreadable",
                            "quality_issues": ["File not found on server"], "tampering_detected": False,
                            "extracted": {"name": None, "id_number": None, "date_of_birth": None,
                                          "expiry_date": None, "issuing_authority": None}},
            "certification": {"present": False, "appears_genuine": None, "quality": "unreadable",
                              "quality_issues": ["File not found on server"],
                              "extracted": {"name": None, "certification_type": None,
                                            "issue_date": None, "expiry_date": None, "issuing_body": None}},
            "profile_photo": {"present": False, "quality": "unreadable",
                              "quality_issues": ["File not found on server"], "is_real_person": None},
            "cross_checks": {"all_names_consistent": None, "name_matches_application": None,
                             "dob_consistent": None, "discrepancies": []},
            "overall": {"recommendation": "reject", "rejection_reasons": ["No documents found on server."],
                        "reupload_documents": [], "flags": ["NO_DOCUMENTS"],
                        "summary": "No documents could be loaded for verification.",
                        "id_expired": False, "expiry_date": None,
                        "duplicate_id_detected": False, "duplicate_app_id": None},
        }

    if not anthropic_key:
        return {
            "national_id": None, "certification": None, "profile_photo": None,
            "cross_checks": {"all_names_consistent": None, "name_matches_application": None,
                             "dob_consistent": None, "discrepancies": []},
            "overall": {"recommendation": "manual_review",
                        "rejection_reasons": ["AI verification not configured."],
                        "reupload_documents": [], "flags": ["VERIFICATION_SKIPPED"],
                        "summary": "ANTHROPIC_API_KEY not set — manual review required.",
                        "id_expired": False, "expiry_date": None,
                        "duplicate_id_detected": False, "duplicate_app_id": None},
        }

    prompt = _COMPREHENSIVE_PROMPT.format(
        expected_name=expected_name,
        docs_list=", ".join(docs_list_labels) or "none",
    )
    content_blocks.append({"type": "text", "text": prompt})

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                _ANT_URL,
                headers={"x-api-key": anthropic_key,
                         "anthropic-version": _ANT_VERSION,
                         "content-type": "application/json"},
                json={"model": _ANT_MODEL, "max_tokens": 2048,
                      "messages": [{"role": "user", "content": content_blocks}]},
            )
            resp.raise_for_status()
            raw = resp.json()["content"][0]["text"].strip()

        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

        result: dict = json.loads(raw)

    except Exception as exc:
        logger.error("verify-application AI call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI verification call failed — try again.")

    # ── Post-process: backend-side checks ────────────────────────────────────

    overall: dict = result.setdefault("overall", {})
    flags: list = overall.setdefault("flags", [])

    # 1. Expiry check on national ID
    id_expired   = False
    expiry_date_str = None
    try:
        expiry_date_str = (result.get("national_id") or {}).get("extracted", {}).get("expiry_date")
        if expiry_date_str:
            if date.fromisoformat(expiry_date_str) < date.today():
                id_expired = True
                flags.append("ID_EXPIRED")
                overall.setdefault("rejection_reasons", []).append(
                    f"National ID has expired (expiry: {expiry_date_str})."
                )
                overall["recommendation"] = "reject"
    except (ValueError, TypeError):
        pass

    # 2. Duplicate ID number check
    duplicate_detected  = False
    duplicate_app_id    = None
    raw_id_num = (result.get("national_id") or {}).get("extracted", {}).get("id_number")
    if raw_id_num:
        norm_id = _normalize_id(raw_id_num)
        async with pool.acquire() as conn:
            dup = await conn.fetchrow(
                "SELECT application_id FROM id_registry WHERE id_number = $1 AND application_id != $2",
                norm_id, application_id,
            )
        if dup:
            duplicate_detected = True
            duplicate_app_id   = dup["application_id"]
            flags.append("DUPLICATE_ID")
            overall.setdefault("rejection_reasons", []).append(
                f"This national ID is already registered under application #{dup['application_id']}."
            )
            overall["recommendation"] = "reject"
        else:
            # Register the ID so future applications are caught
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO id_registry (id_number, full_name, phone, application_id)
                       VALUES ($1, $2, $3, $4) ON CONFLICT (id_number) DO NOTHING""",
                    norm_id, expected_name, data.get("phone"), application_id,
                )

    # 3. Note missing documents (files were absent, not just unreadable)
    for m in missing_docs:
        overall.setdefault("reupload_documents", []).append(m)
        if overall.get("recommendation") not in ("reject",):
            overall["recommendation"] = "reupload_needed"

    overall["id_expired"]             = id_expired
    overall["expiry_date"]            = expiry_date_str
    overall["duplicate_id_detected"]  = duplicate_detected
    overall["duplicate_app_id"]       = duplicate_app_id

    await log_event(
        None, event_type="ai_verification",
        description=f"AI verify application #{application_id}: {overall.get('recommendation')} — {overall.get('summary', '')}",
    ) if False else None   # log_event needs a conn; skip for now

    return result


# ── POST /providers/applications/{id}/request-reupload ───────────────────────

class ReuploadRequest(BaseModel):
    documents: List[str]   # e.g. ["National ID / Driving Licence", "Professional Certification"]
    note: Optional[str] = None


@router.post("/applications/{application_id}/request-reupload",
             dependencies=[Depends(require_role("admin"))])
async def request_reupload(
    application_id: int,
    body: ReuploadRequest,
    request: Request,
):
    """Mark an application as needing specific documents re-uploaded and SMS the applicant."""
    pool = await _get_pool(request)

    async with pool.acquire() as conn:
        app_row = await conn.fetchrow(
            "SELECT phone, full_name, verification_status FROM provider_applications WHERE id = $1",
            application_id,
        )
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if app_row["verification_status"] not in ("pending", "needs_reupload"):
            raise HTTPException(status_code=400, detail="Application is not in a reviewable state")

        docs_str = ", ".join(body.documents)
        await conn.execute(
            """
            UPDATE provider_applications
            SET verification_status       = 'needs_reupload',
                reupload_requested_docs   = $1,
                reupload_requested_at     = NOW()
            WHERE id = $2
            """,
            docs_str, application_id,
        )

    provider_url = os.getenv("PROVIDER_APP_URL", "http://localhost:8084")
    sms = (
        f"MOTOFIX: Your application needs updated documents.\n"
        f"Please re-submit via {provider_url}/apply using your registered phone.\n"
        f"Documents required: {docs_str}."
    )
    if body.note:
        sms += f"\nNote: {body.note}"
    try:
        send_sms(app_row["phone"], sms)
    except Exception as exc:
        logger.warning("Re-upload SMS failed (non-fatal): %s", exc)
