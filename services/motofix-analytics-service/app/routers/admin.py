from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from ..deps import verify_admin_token
from ..db import get_db, get_auth_db

router = APIRouter(prefix="/admin", tags=["Admin"])


# ──────────────────────────── MODELS ────────────────────────────

class MediaFile(BaseModel):
    url: str
    file_type: str  # "voice", "photo", "document"
    size_kb: float
    uploaded_at: str


class ServiceRequestResponse(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    location: str
    description: str
    service_type: str
    status: str
    media_files: Optional[List[MediaFile]] = []
    created_at: str
    updated_at: Optional[str] = None
    dispatched_at: Optional[str] = None
    accepted_at: Optional[str] = None
    en_route_at: Optional[str] = None
    arrived_at: Optional[str] = None
    service_started_at: Optional[str] = None
    completed_at: Optional[str] = None
    time_to_accept_min: Optional[int] = Field(default=None, description="Dispatched → Accepted")
    drive_time_min: Optional[int] = Field(default=None, description="En route/Accepted → Arrived")
    service_time_min: Optional[int] = Field(default=None, description="Service started → Completed")
    total_duration_min: Optional[int] = Field(default=None, description="Dispatched → Completed")


def _minutes_between(a: Optional[datetime], b: Optional[datetime]) -> Optional[int]:
    if not a or not b:
        return None
    try:
        mins = int(round((b - a).total_seconds() / 60.0))
        return max(0, mins)
    except Exception:
        return None


class MechanicCreate(BaseModel):
    phone: str
    name: str
    location: Optional[str] = None
    is_verified: bool = False


class MechanicUpdate(BaseModel):
    phone: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    is_verified: Optional[bool] = None
    rating: Optional[int] = None
    jobs_completed: Optional[int] = None


# ────────────────────────── SERVICE REQUESTS ──────────────────────────

@router.get("/requests")
async def list_requests(
    status: Optional[str] = Query(None),
    limit: int = 100,
    db=Depends(get_db),
    admin=Depends(verify_admin_token)
):
    """
    List service requests with media files.
    Returns requests with voice notes, photos, and documents.
    """
    base_query = """
        SELECT *
        FROM service_requests
        {where}
        ORDER BY created_at DESC
        LIMIT $1
    """
    if status:
        rows = await db.fetch(base_query.format(where="WHERE status = $2"), limit, status)
    else:
        rows = await db.fetch(base_query.format(where=""), limit)
    
    # Fetch media files for each request
    requests_data = []
    for row in rows:
        request_dict = dict(row)
        media_rows = await db.fetch(
            "SELECT url, file_type, size_kb, uploaded_at FROM media_files WHERE request_id = $1 ORDER BY uploaded_at DESC",
            row['id']
        )
        request_dict['media_files'] = [dict(m) for m in media_rows] if media_rows else []

        dispatched_at = request_dict.get("dispatched_at") or request_dict.get("created_at")
        accepted_at = request_dict.get("accepted_at")
        en_route_at = request_dict.get("en_route_at") or accepted_at
        arrived_at = request_dict.get("arrived_at")
        service_started_at = request_dict.get("service_started_at")
        completed_at = request_dict.get("completed_at")

        request_dict["time_to_accept_min"] = _minutes_between(dispatched_at, accepted_at)
        request_dict["drive_time_min"] = _minutes_between(en_route_at, arrived_at)
        request_dict["service_time_min"] = _minutes_between(service_started_at, completed_at)
        request_dict["total_duration_min"] = _minutes_between(dispatched_at, completed_at)
        requests_data.append(request_dict)
    
    return requests_data


# ───────────────────────────── MECHANICS ──────────────────────────────

@router.get("/mechanics")
async def list_mechanics(
    verified: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    """
    Return mechanics with optional search and pagination.
    Supports filtering by verification status and fuzzy match on name/phone/location.
    """
    offset = (page - 1) * pageSize
    params = []
    conditions = []

    if verified is not None:
        conditions.append(f"is_verified = ${len(params) + 1}")
        params.append(verified)

    if search:
        like_term = f"%{search.lower()}%"
        conditions.append(
            f"(lower(name) LIKE ${len(params) + 1} OR lower(phone) LIKE ${len(params) + 1} OR lower(location) LIKE ${len(params) + 1})"
        )
        params.append(like_term)

    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""

    total = await db.fetchval(f"SELECT COUNT(*) FROM mechanics{where_sql}", *params)

    query = f"""
        SELECT id, phone, name, location, is_verified, rating, jobs_completed, created_at
        FROM mechanics
        {where_sql}
        ORDER BY created_at DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
    """
    rows = await db.fetch(query, *params, pageSize, offset)

    data = [dict(r) for r in rows]
    return {
        "data": data,
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": (total + pageSize - 1) // pageSize if total is not None else 0,
    }


@router.post("/mechanics")
async def add_mechanic(
    mechanic: MechanicCreate,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    # Normalize phone
    phone = mechanic.phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("0"):
        phone = "+256" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+256" + phone

    query = """
        INSERT INTO mechanics (phone, name, location, is_verified, rating, jobs_completed)
        VALUES ($1, $2, $3, $4, 0, 0)
        RETURNING *
    """

    result = await db.fetchrow(
        query,
        phone,
        mechanic.name,
        mechanic.location,
        mechanic.is_verified
    )

    return dict(result)


@router.patch("/mechanics/{mechanic_id}")
async def update_mechanic(
    mechanic_id: int,
    updates: MechanicUpdate,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    update_data = updates.dict(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # Build dynamic SQL
    set_parts = []
    params = []

    for idx, (key, value) in enumerate(update_data.items(), start=1):
        set_parts.append(f"{key} = ${idx}")
        params.append(value)

    params.append(mechanic_id)

    query = f"""
        UPDATE mechanics
        SET {', '.join(set_parts)}
        WHERE id = ${len(params)}
        RETURNING *
    """

    result = await db.fetchrow(query, *params)

    if not result:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    return dict(result)


@router.delete("/mechanics/{mechanic_id}")
async def delete_mechanic(
    mechanic_id: int,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    result = await db.fetchval("DELETE FROM mechanics WHERE id = $1 RETURNING id", mechanic_id)

    if not result:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    return {"detail": "Mechanic deleted successfully"}


# ───────────────────────────── TOWING PROVIDERS ──────────────────────────────

class TowingProviderUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    is_verified: Optional[bool] = None


@router.get("/towing-providers")
async def list_towing_providers(
    verified: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token),
):
    offset = (page - 1) * pageSize
    params: list = []
    conditions: list = []

    if verified is not None:
        conditions.append(f"is_verified = ${len(params) + 1}")
        params.append(verified)

    if search:
        like_term = f"%{search.lower()}%"
        conditions.append(
            f"(lower(full_name) LIKE ${len(params) + 1} OR lower(phone) LIKE ${len(params) + 1} OR lower(location) LIKE ${len(params) + 1})"
        )
        params.append(like_term)

    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""
    total = await db.fetchval(f"SELECT COUNT(*) FROM towing_providers{where_sql}", *params)

    rows = await db.fetch(
        f"""SELECT id, phone, full_name AS name, location, is_verified, is_available, spn, created_at
            FROM towing_providers{where_sql}
            ORDER BY created_at DESC
            LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}""",
        *params, pageSize, offset,
    )

    return {
        "data": [dict(r) for r in rows],
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": max(1, (total + pageSize - 1) // pageSize) if total else 1,
    }


@router.patch("/towing-providers/{provider_id}")
async def update_towing_provider(
    provider_id: int,
    updates: TowingProviderUpdate,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token),
):
    update_data = updates.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts: list = []
    params: list = []
    for key, val in update_data.items():
        col = "full_name" if key == "name" else key
        set_parts.append(f"{col} = ${len(params) + 1}")
        params.append(val)

    params.append(provider_id)
    row = await db.fetchrow(
        f"UPDATE towing_providers SET {', '.join(set_parts)} WHERE id = ${len(params)} "
        f"RETURNING id, phone, full_name AS name, location, is_verified, is_available, spn, created_at",
        *params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Towing provider not found")
    return dict(row)


@router.delete("/towing-providers/{provider_id}")
async def delete_towing_provider(
    provider_id: int,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token),
):
    result = await db.fetchval("DELETE FROM towing_providers WHERE id = $1 RETURNING id", provider_id)
    if not result:
        raise HTTPException(status_code=404, detail="Towing provider not found")
    return {"detail": "Towing provider deleted successfully"}


# ───────────────────────────── PAYMENTS WITH PAGINATION ───────────────────────────────

@router.get("/payments")
async def list_payments(
    search: Optional[str] = Query(None, description="Search by driver name or phone"),
    collection_status: Optional[str] = Query(None),
    disbursement_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db=Depends(get_db),
    admin=Depends(verify_admin_token)
):
    offset = (page - 1) * page_size
    params: list = []
    conditions: list = []

    if search:
        like = f"%{search.lower()}%"
        conditions.append(
            f"(lower(sr.customer_name) LIKE ${len(params)+1} OR lower(sr.phone) LIKE ${len(params)+1})"
        )
        params.append(like)

    if collection_status:
        conditions.append(f"p.collection_status = ${len(params)+1}")
        params.append(collection_status)

    if disbursement_status:
        conditions.append(f"p.disbursement_status = ${len(params)+1}")
        params.append(disbursement_status)

    where_sql = " WHERE " + " AND ".join(conditions) if conditions else ""

    # Use LEFT JOIN mechanics only if the table exists (motofix_dispatch may not have it)
    try:
        await db.fetchval("SELECT 1 FROM mechanics LIMIT 1")
        mech_join = "LEFT JOIN mechanics m ON p.mechanic_id = m.id"
        mech_select = "m.name AS mechanic_name"
    except Exception:
        mech_join = ""
        mech_select = "NULL::text AS mechanic_name"

    base_from = f"""
        FROM payments p
        JOIN service_requests sr ON p.request_id = sr.id
        {mech_join}
    """

    total = await db.fetchval(
        f"SELECT COUNT(*) {base_from}{where_sql}", *params
    )

    query = f"""
        SELECT p.id, p.request_id, p.quoted_amount, p.commission, p.mechanic_payout,
               p.collection_status, p.disbursement_status,
               p.collection_reference, p.disbursement_reference, p.created_at,
               sr.customer_name, sr.phone AS driver_phone,
               {mech_select}, p.mechanic_id
        {base_from}
        {where_sql}
        ORDER BY p.created_at DESC
        LIMIT ${len(params)+1} OFFSET ${len(params)+2}
    """

    params.extend([page_size, offset])
    rows = await db.fetch(query, *params)

    return {
        "data": [dict(r) for r in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
            "has_next": page * page_size < total,
            "has_prev": page > 1,
        },
        "search": {"search": search, "collection_status": collection_status, "disbursement_status": disbursement_status},
    }


# ────────────────────────────── LIVE OPERATIONAL STATS ─────────────────────────────────

@router.get("/live-stats")
async def live_stats(
    db=Depends(get_db),
    auth_db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    active_requests = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status NOT IN ('completed', 'cancelled')"
    ) or 0
    stuck_requests = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes'"
    ) or 0
    requests_today = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE created_at >= CURRENT_DATE"
    ) or 0
    completed_today = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status = 'completed' AND created_at >= CURRENT_DATE"
    ) or 0
    completion_rate_today = round(completed_today / requests_today * 100, 1) if requests_today > 0 else 0.0

    try:
        towing_online = await auth_db.fetchval(
            "SELECT COUNT(*) FROM towing_providers WHERE is_available = true"
        ) or 0
    except Exception:
        towing_online = 0
    try:
        mechanics_online = await auth_db.fetchval(
            "SELECT COUNT(*) FROM mechanics WHERE is_available = true"
        ) or 0
    except Exception:
        mechanics_online = 0

    return {
        "active_requests": active_requests,
        "stuck_requests": stuck_requests,
        "requests_today": requests_today,
        "completed_today": completed_today,
        "completion_rate_today": completion_rate_today,
        "towing_online": towing_online,
        "mechanics_online": mechanics_online,
        "as_of": datetime.utcnow().isoformat() + "Z",
    }


# ────────────────────────────── MAP DATA ─────────────────────────────────

@router.get("/map-data")
async def map_data(
    db=Depends(get_db),
    auth_db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    try:
        mechanic_rows = await auth_db.fetch(
            """SELECT id, name, phone, location, is_verified, latitude, longitude
               FROM mechanics
               WHERE latitude IS NOT NULL AND longitude IS NOT NULL"""
        )
    except Exception:
        mechanic_rows = []

    try:
        towing_rows = await auth_db.fetch(
            """SELECT id, full_name AS name, phone, location, is_verified, is_available, latitude, longitude
               FROM towing_providers
               WHERE latitude IS NOT NULL AND longitude IS NOT NULL"""
        )
    except Exception:
        towing_rows = []

    request_rows = await db.fetch(
        """SELECT id, customer_name, location, status, service_type, created_at
           FROM service_requests
           WHERE status NOT IN ('completed', 'cancelled')
           ORDER BY created_at DESC
           LIMIT 50"""
    )

    return {
        "mechanics": [dict(r) for r in mechanic_rows],
        "towing_providers": [dict(r) for r in towing_rows],
        "active_requests": [dict(r) for r in request_rows],
    }


# ────────────────────────────── STATS ─────────────────────────────────

@router.get("/stats")
async def dashboard_stats(
    db=Depends(get_db),
    auth_db=Depends(get_auth_db),
    admin=Depends(verify_admin_token)
):
    stats = {}

    stats["total_requests"] = await db.fetchval("SELECT COUNT(*) FROM service_requests") or 0
    stats["completed_jobs"] = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status = 'completed'"
    ) or 0
    stats["pending_jobs"] = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status IN ('pending', 'accepted')"
    ) or 0

    try:
        stats["total_mechanics"] = await auth_db.fetchval("SELECT COUNT(*) FROM mechanics") or 0
        stats["verified_mechanics"] = await auth_db.fetchval(
            "SELECT COUNT(*) FROM mechanics WHERE is_verified = true"
        ) or 0
    except Exception:
        stats["total_mechanics"] = 0
        stats["verified_mechanics"] = 0

    collected = await db.fetchval(
        "SELECT COALESCE(SUM(quoted_amount), 0) FROM payments WHERE collection_status='success'"
    )
    paid_out = await db.fetchval(
        "SELECT COALESCE(SUM(mechanic_payout), 0) FROM payments WHERE disbursement_status='success'"
    )

    stats["revenue_collected_ugx"] = float(collected or 0)
    stats["paid_to_mechanics_ugx"] = float(paid_out or 0)
    stats["profit_ugx"] = float((collected or 0) - (paid_out or 0))
    stats["total_transactions"] = await db.fetchval("SELECT COUNT(*) FROM payments") or 0

    stats["as_of"] = datetime.utcnow().isoformat() + "Z"
    stats["motofix_is_unstoppable"] = True

    return stats


# ───────────────────────────── REVENUE CHART ─────────────────────────────

@router.get("/dashboard/revenue-chart")
async def revenue_chart(
    limit: int = 30,
    db=Depends(get_db),
    admin=Depends(verify_admin_token)
):
    query = """
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
               COALESCE(SUM(quoted_amount), 0) AS amount
        FROM payments
        WHERE collection_status = 'success'
        GROUP BY date
        ORDER BY date DESC
        LIMIT $1
    """

    rows = await db.fetch(query, limit)

    data = [
        {"date": r["date"], "amount": float(r["amount"])}
        for r in rows
    ]

    return list(reversed(data))


# ─────────────── MECHANIC VERIFICATION WORKFLOW ───────────────

class VerifyDecision(BaseModel):
    is_verified: bool
    reason: Optional[str] = None          # e.g. "Documents verified" or "Incomplete submission"


@router.patch("/mechanics/{mechanic_id}/verify")
async def verify_mechanic(
    mechanic_id: int,
    decision: VerifyDecision,
    db=Depends(get_auth_db),
    admin=Depends(verify_admin_token),
):
    """
    Admin grants or revokes mechanic verification.
    Sets is_verified on the mechanics table and writes a system_log entry.
    """
    try:
        row = await db.fetchrow(
            "UPDATE mechanics SET is_verified = $1 WHERE id = $2 RETURNING *",
            decision.is_verified, mechanic_id,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Mechanics table not available in this DB: {e}")
    if not row:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    action = "MECHANIC_VERIFIED" if decision.is_verified else "MECHANIC_UNVERIFIED"
    admin_id = admin.get("sub") or admin.get("id") or "admin"

    # Write system log (best-effort)
    try:
        await db.execute(
            """
            INSERT INTO system_logs (actor_id, actor_role, action, target_id, target_type, detail, created_at)
            VALUES ($1, 'admin', $2, $3, 'mechanic', $4, NOW())
            """,
            str(admin_id), action, mechanic_id,
            decision.reason or ("Verified" if decision.is_verified else "Unverified"),
        )
    except Exception as e:
        # system_logs table may not exist yet; non-fatal
        pass

    return {
        "mechanic_id": mechanic_id,
        "is_verified": decision.is_verified,
        "reason": decision.reason,
        "mechanic": dict(row),
    }


@router.get("/mechanics/{mechanic_id}/reviews")
async def mechanic_reviews(
    mechanic_id: int,
    limit: int = 50,
    db=Depends(get_db),           # reviews + service_requests live in requests DB
    admin=Depends(verify_admin_token),
):
    """Admin view of all reviews for a mechanic with rating summary."""
    rows = await db.fetch(
        """
        SELECT r.id, r.request_id, r.rating, r.comment, r.created_at,
               sr.customer_name, sr.service_type, sr.location
        FROM reviews r
        JOIN service_requests sr ON sr.id = r.request_id
        WHERE r.mechanic_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2
        """,
        mechanic_id, limit,
    )
    total = await db.fetchval("SELECT COUNT(*) FROM reviews WHERE mechanic_id = $1", mechanic_id)
    avg = await db.fetchval(
        "SELECT AVG(rating)::NUMERIC(3,2) FROM reviews WHERE mechanic_id = $1", mechanic_id
    )

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


# ─────────────── SYSTEM LOGS (Compliance) ───────────────

class SystemLogOut(BaseModel):
    id: int
    actor_id: str
    actor_role: str
    action: str
    target_id: Optional[int] = None
    target_type: Optional[str] = None
    detail: Optional[str] = None
    created_at: Optional[str] = None


async def _ensure_system_logs(db):
    """Create system_logs table if it doesn't exist (idempotent)."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id          SERIAL PRIMARY KEY,
            actor_id    TEXT NOT NULL,
            actor_role  TEXT NOT NULL DEFAULT 'system',
            action      TEXT NOT NULL,
            target_id   INTEGER,
            target_type TEXT,
            detail      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


@router.get("/logs", tags=["Compliance"])
async def list_system_logs(
    action: Optional[str] = Query(None, description="Filter by action type"),
    actor_role: Optional[str] = Query(None, description="Filter by actor role"),
    target_type: Optional[str] = Query(None, description="Filter by target type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """
    Compliance audit log — all significant system actions.
    Required for Uganda Data Protection & Privacy Act (2019) compliance.
    """
    await _ensure_system_logs(db)

    conditions = []
    params = []

    if action:
        conditions.append(f"action = ${len(params)+1}")
        params.append(action)
    if actor_role:
        conditions.append(f"actor_role = ${len(params)+1}")
        params.append(actor_role)
    if target_type:
        conditions.append(f"target_type = ${len(params)+1}")
        params.append(target_type)

    where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

    total = await db.fetchval(f"SELECT COUNT(*) FROM system_logs {where_sql}", *params)
    rows = await db.fetch(
        f"""
        SELECT id, actor_id, actor_role, action, target_id, target_type, detail, created_at
        FROM system_logs
        {where_sql}
        ORDER BY created_at DESC
        LIMIT ${len(params)+1} OFFSET ${len(params)+2}
        """,
        *params, limit, offset,
    )

    logs = []
    for r in rows:
        lg = dict(r)
        if lg.get("created_at"):
            lg["created_at"] = lg["created_at"].isoformat()
        logs.append(lg)

    return {
        "total": total or 0,
        "limit": limit,
        "offset": offset,
        "logs": logs,
    }


@router.post("/logs", tags=["Compliance"])
async def write_system_log(
    actor_id: str,
    actor_role: str,
    action: str,
    target_id: Optional[int] = None,
    target_type: Optional[str] = None,
    detail: Optional[str] = None,
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """Manually write a compliance audit log entry (admin only)."""
    await _ensure_system_logs(db)
    row = await db.fetchrow(
        """
        INSERT INTO system_logs (actor_id, actor_role, action, target_id, target_type, detail)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, actor_id, actor_role, action, target_id, target_type, detail, created_at
        """,
        actor_id, actor_role, action, target_id, target_type, detail,
    )
    result = dict(row)
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    return result


@router.get("/compliance/report", tags=["Compliance"])
async def compliance_report(
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """
    Summary compliance report for KCCA/UNRA submission.
    Covers verifications performed, requests handled, payments processed.
    """
    await _ensure_system_logs(db)

    total_requests = await db.fetchval("SELECT COUNT(*) FROM service_requests") or 0
    completed = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status = 'completed'"
    ) or 0
    cancelled = await db.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE status = 'cancelled'"
    ) or 0
    total_mechanics = await db.fetchval("SELECT COUNT(*) FROM mechanics") or 0
    verified_mechanics = await db.fetchval(
        "SELECT COUNT(*) FROM mechanics WHERE is_verified = true"
    ) or 0
    total_payments = await db.fetchval("SELECT COUNT(*) FROM payments") or 0
    collected_ugx = await db.fetchval(
        "SELECT COALESCE(SUM(quoted_amount), 0) FROM payments WHERE collection_status = 'successful'"
    ) or 0
    disbursed_ugx = await db.fetchval(
        "SELECT COALESCE(SUM(mechanic_payout), 0) FROM payments WHERE disbursement_status = 'pending'"
    ) or 0

    # Verification events in the last 30 days
    verifications_30d = await db.fetchval(
        """
        SELECT COUNT(*) FROM system_logs
        WHERE action IN ('MECHANIC_VERIFIED', 'MECHANIC_UNVERIFIED')
          AND created_at >= NOW() - INTERVAL '30 days'
        """
    ) or 0

    return {
        "report_generated_at": datetime.utcnow().isoformat() + "Z",
        "service_requests": {
            "total": total_requests,
            "completed": completed,
            "cancelled": cancelled,
            "completion_rate_pct": round(completed / total_requests * 100, 1) if total_requests else 0,
        },
        "mechanic_management": {
            "total_registered": total_mechanics,
            "verified": verified_mechanics,
            "unverified": total_mechanics - verified_mechanics,
            "verification_events_last_30d": verifications_30d,
        },
        "payments": {
            "total_transactions": total_payments,
            "total_collected_ugx": float(collected_ugx),
            "total_disbursed_ugx": float(disbursed_ugx),
            "platform_revenue_ugx": float(collected_ugx) - float(disbursed_ugx),
        },
        "compliance_framework": "Uganda Data Protection and Privacy Act (2019)",
        "reporting_entities": ["KCCA", "UNRA"],
    }


# ─────────────── SUBSCRIPTION MANAGEMENT ───────────────

class SubscriptionRecord(BaseModel):
    mechanic_id: int
    mechanic_phone: str
    status: str                              # trial | active | grace | expired
    plan: Optional[str] = "monthly"
    amount_ugx: Optional[int] = 20000
    trial_ends_at: Optional[str] = None
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    grace_ends_at: Optional[str] = None
    payment_ref: Optional[str] = None
    payment_method: Optional[str] = None


class RecordPaymentIn(BaseModel):
    mechanic_id: int
    mechanic_phone: str
    amount_ugx: int = 20000
    payment_method: str = "bank_transfer"
    payment_ref: Optional[str] = None
    recorded_by: Optional[str] = None


@router.get("/subscriptions")
async def list_subscriptions(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=200),
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """List mechanic subscriptions with optional status filter."""
    offset = (page - 1) * pageSize
    conditions = []
    params: list = []

    if status:
        conditions.append(f"status = ${len(params)+1}")
        params.append(status)

    where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
    total = await db.fetchval(f"SELECT COUNT(*) FROM subscriptions {where_sql}", *params)
    rows = await db.fetch(
        f"""SELECT * FROM subscriptions {where_sql}
            ORDER BY updated_at DESC
            LIMIT ${len(params)+1} OFFSET ${len(params)+2}""",
        *params, pageSize, offset,
    )

    def _fmt(r):
        d = dict(r)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        return d

    return {
        "data": [_fmt(r) for r in rows],
        "page": page, "pageSize": pageSize,
        "total": total or 0,
        "totalPages": max(1, ((total or 0) + pageSize - 1) // pageSize),
    }


@router.post("/subscriptions/record-payment")
async def record_subscription_payment(
    body: RecordPaymentIn,
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """
    Admin records a bank-transfer subscription payment for a mechanic.
    Activates or renews the subscription for one calendar month.
    """
    from datetime import timezone, timedelta

    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    period_start = now
    period_end = now + timedelta(days=30)

    # Upsert subscription row
    await db.execute("""
        INSERT INTO subscriptions
            (mechanic_id, mechanic_phone, status, plan, amount_ugx,
             current_period_start, current_period_end, payment_ref, payment_method, updated_at)
        VALUES ($1,$2,'active','monthly',$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (mechanic_id) DO UPDATE SET
            status               = 'active',
            current_period_start = EXCLUDED.current_period_start,
            current_period_end   = EXCLUDED.current_period_end,
            payment_ref          = EXCLUDED.payment_ref,
            payment_method       = EXCLUDED.payment_method,
            amount_ugx           = EXCLUDED.amount_ugx,
            grace_ends_at        = NULL,
            updated_at           = NOW()
    """, body.mechanic_id, body.mechanic_phone, body.amount_ugx,
         period_start, period_end, body.payment_ref, body.payment_method)

    # Log the payment event
    await db.execute("""
        INSERT INTO subscription_payments
            (mechanic_id, mechanic_phone, amount_ugx, payment_method, payment_ref,
             period_start, period_end, recorded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    """, body.mechanic_id, body.mechanic_phone, body.amount_ugx,
         body.payment_method, body.payment_ref, period_start, period_end,
         body.recorded_by or "admin")

    return {
        "message": "Payment recorded — subscription activated",
        "mechanic_id": body.mechanic_id,
        "status": "active",
        "period_end": period_end.isoformat(),
    }


@router.get("/subscriptions/{mechanic_id}")
async def get_subscription(
    mechanic_id: int,
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """Get the current subscription state for a mechanic."""
    row = await db.fetchrow(
        "SELECT * FROM subscriptions WHERE mechanic_id = $1", mechanic_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="No subscription found for this mechanic")
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


@router.get("/subscriptions/{mechanic_id}/payments")
async def subscription_payment_history(
    mechanic_id: int,
    limit: int = 24,
    db=Depends(get_db),
    admin=Depends(verify_admin_token),
):
    """Full payment history for a mechanic's subscription."""
    rows = await db.fetch(
        """SELECT * FROM subscription_payments WHERE mechanic_id = $1
           ORDER BY created_at DESC LIMIT $2""",
        mechanic_id, limit,
    )
    results = []
    for r in rows:
        d = dict(r)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        results.append(d)
    return {"mechanic_id": mechanic_id, "payments": results}


# ─────────────── ADMIN NOTIFICATIONS FEED ───────────────

@router.get("/notifications")
async def admin_notifications(
    limit: int = Query(30, ge=1, le=100),
    db=Depends(get_db),
    auth_db=Depends(get_auth_db),
    admin=Depends(verify_admin_token),
):
    """
    Aggregate real events into a notification feed for the admin portal.
    Sources: service_requests, payments (dispatch DB) + provider_applications, users (auth DB).
    """
    events = []

    # ── Service requests ─────────────────────────────────────────────
    try:
        rows = await db.fetch(
            """SELECT id, customer_name, service_type, location, status, created_at
               FROM service_requests
               ORDER BY created_at DESC
               LIMIT 15"""
        )
        for r in rows:
            cname = r["customer_name"] or "A driver"
            stype = (r["service_type"] or "service").lower()
            loc   = r["location"] or "unknown location"
            status = r["status"] or "pending"
            events.append({
                "id":         f"req-{r['id']}",
                "type":       "request",
                "title":      "New Service Request",
                "body":       f"{cname} submitted a {stype} request.",
                "detail":     (
                    f"{cname} submitted a service request for {stype} at {loc}. "
                    f"Current status: {status}. Request ID: #{r['id']}."
                ),
                "created_at": r["created_at"].isoformat(),
            })
    except Exception:
        pass

    # ── Successful payments ──────────────────────────────────────────
    try:
        rows = await db.fetch(
            """SELECT p.id, p.request_id, p.quoted_amount, p.collection_status,
                      p.disbursement_status, p.created_at,
                      sr.customer_name, sr.service_type
               FROM payments p
               LEFT JOIN service_requests sr ON p.request_id = sr.id
               WHERE p.collection_status = 'success'
               ORDER BY p.created_at DESC
               LIMIT 10"""
        )
        for r in rows:
            cname = r["customer_name"] or "a driver"
            amt   = int(r["quoted_amount"] or 0)
            stype = r["service_type"] or "service"
            events.append({
                "id":         f"pay-{r['id']}",
                "type":       "payment",
                "title":      "Payment Received",
                "body":       f"UGX {amt:,} collected for Request #{r['request_id']}.",
                "detail":     (
                    f"A payment of UGX {amt:,} was successfully collected for "
                    f"Request #{r['request_id']} ({stype} — {cname}). "
                    f"Disbursement status: {r['disbursement_status'] or 'pending'}."
                ),
                "created_at": r["created_at"].isoformat(),
            })
    except Exception:
        pass

    # ── Provider applications ────────────────────────────────────────
    try:
        rows = await auth_db.fetch(
            """SELECT id, full_name, phone, provider_type, service_area,
                      verification_status, submitted_at
               FROM provider_applications
               ORDER BY submitted_at DESC
               LIMIT 10"""
        )
        for r in rows:
            name   = r["full_name"] or "A provider"
            ptype  = (r["provider_type"] or "provider").replace("_", " ")
            area   = r["service_area"] or "unspecified area"
            vstatus = r["verification_status"] or "pending"
            ts = r["submitted_at"]
            events.append({
                "id":         f"app-{r['id']}",
                "type":       "provider",
                "title":      "Provider Application",
                "body":       f"{name} applied as a {ptype}.",
                "detail":     (
                    f"{name} ({r['phone']}) submitted a {ptype} application. "
                    f"Service area: {area}. Verification status: {vstatus}."
                ),
                "created_at": ts.isoformat() if ts else datetime.utcnow().isoformat(),
            })
    except Exception:
        pass

    # ── Driver registrations ─────────────────────────────────────────
    try:
        rows = await auth_db.fetch(
            """SELECT id, phone, full_name, number_plate, vehicle_type, created_at
               FROM users
               ORDER BY created_at DESC
               LIMIT 10"""
        )
        for r in rows:
            name    = r["full_name"] or r["phone"] or "A driver"
            plate   = r["number_plate"] or ""
            vtype   = r["vehicle_type"] or ""
            vehicle = f" ({vtype} — {plate})" if plate else (f" ({vtype})" if vtype else "")
            events.append({
                "id":         f"drv-{r['id']}",
                "type":       "driver",
                "title":      "New Driver Registered",
                "body":       f"{name} completed driver registration.",
                "detail":     (
                    f"{name} (Phone: {r['phone']}) registered as a driver{vehicle}. "
                    f"Account is active."
                ),
                "created_at": r["created_at"].isoformat(),
            })
    except Exception:
        pass

    # ── Sort newest-first, cap at limit ─────────────────────────────
    events.sort(key=lambda x: x["created_at"], reverse=True)
    return events[:limit]