# app/routers/parts_catalog.py
# Admin-curated spare-parts catalog. Keyed by the diagnosis fault_category, each
# entry overrides the AI's suggested parts list, part price range, and typical
# service-fee range that the driver app shows for parts-fixable breakdowns.

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.services.logger import log_event
from app.middleware.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Spare Parts Catalog"])


# ── DB helper ──────────────────────────────────────────────────────────────────

async def _get_conn(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": True, "code": "DB_UNAVAILABLE",
                    "message": "Database connection pool not initialised", "status_code": 503},
        )
    return pool


# ── Schemas ────────────────────────────────────────────────────────────────────

class PartItem(BaseModel):
    name: str = Field(..., description="Part name, e.g. 'Tube' or 'Car battery (NS60)'")
    price_min: int = Field(0, ge=0, description="Lower bound of typical part price in UGX")
    price_max: int = Field(0, ge=0, description="Upper bound of typical part price in UGX")


class CatalogUpsert(BaseModel):
    label: str = Field("", description="Human-friendly fault label shown to drivers")
    parts: List[PartItem] = Field(default_factory=list)
    service_fee_min: Optional[int] = Field(None, ge=0, description="Typical fitting/labour fee — low end (UGX)")
    service_fee_max: Optional[int] = Field(None, ge=0, description="Typical fitting/labour fee — high end (UGX)")
    notes: Optional[str] = Field(None, description="Optional driver-facing advice")


class CatalogEntry(CatalogUpsert):
    fault_category: str
    updated_at: Optional[str] = None


def _row_to_entry(row) -> dict:
    parts = row["parts"]
    if isinstance(parts, str):          # asyncpg returns jsonb as str (no codec registered)
        try:
            parts = json.loads(parts)
        except (ValueError, TypeError):
            parts = []
    return {
        "fault_category": row["fault_category"],
        "label": row["label"] or "",
        "parts": parts or [],
        "service_fee_min": row["service_fee_min"],
        "service_fee_max": row["service_fee_max"],
        "notes": row["notes"],
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


# ── Admin: list all ─────────────────────────────────────────────────────────────

@router.get("/admin/parts-catalog", summary="List all spare-parts catalog entries (admin)")
async def list_catalog(request: Request, _admin: dict = Depends(require_role("admin"))):
    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT fault_category, label, parts, service_fee_min, service_fee_max, notes, updated_at "
            "FROM spare_parts_catalog ORDER BY fault_category ASC"
        )
    return [_row_to_entry(r) for r in rows]


# ── Admin: create / override ─────────────────────────────────────────────────────

@router.put("/admin/parts-catalog/{fault_category}", summary="Create or update a catalog entry (admin)")
async def upsert_catalog(
    fault_category: str,
    body: CatalogUpsert,
    request: Request,
    admin: dict = Depends(require_role("admin")),
):
    if body.service_fee_min is not None and body.service_fee_max is not None \
            and body.service_fee_min > body.service_fee_max:
        raise HTTPException(status_code=422, detail="service_fee_min cannot exceed service_fee_max")

    parts_json = json.dumps([p.model_dump() for p in body.parts])
    admin_id = int(admin["sub"]) if admin.get("sub") else None

    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO spare_parts_catalog
                (fault_category, label, parts, service_fee_min, service_fee_max, notes, updated_by, updated_at)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, NOW())
            ON CONFLICT (fault_category) DO UPDATE SET
                label           = EXCLUDED.label,
                parts           = EXCLUDED.parts,
                service_fee_min = EXCLUDED.service_fee_min,
                service_fee_max = EXCLUDED.service_fee_max,
                notes           = EXCLUDED.notes,
                updated_by      = EXCLUDED.updated_by,
                updated_at      = NOW()
            RETURNING fault_category, label, parts, service_fee_min, service_fee_max, notes, updated_at
            """,
            fault_category, body.label, parts_json,
            body.service_fee_min, body.service_fee_max, body.notes, admin_id,
        )
        await log_event(
            conn,
            event_type="parts_catalog_updated",
            description=f"Spare-parts catalog entry saved for '{fault_category}'",
        )
    return _row_to_entry(row)


# ── Admin: delete override (revert to AI defaults) ───────────────────────────────

@router.delete("/admin/parts-catalog/{fault_category}", summary="Delete a catalog entry (admin)")
async def delete_catalog(
    fault_category: str,
    request: Request,
    _admin: dict = Depends(require_role("admin")),
):
    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        deleted = await conn.fetchval(
            "DELETE FROM spare_parts_catalog WHERE fault_category = $1 RETURNING fault_category",
            fault_category,
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="No catalog entry for that fault category")
        await log_event(
            conn,
            event_type="parts_catalog_deleted",
            description=f"Spare-parts catalog entry removed for '{fault_category}' (reverted to AI defaults)",
        )
    return {"message": "Catalog entry removed", "fault_category": fault_category}


# ── Public read (driver app override lookup) ─────────────────────────────────────

@router.get("/parts-catalog/{fault_category}", summary="Get the admin override for a fault category (public)")
async def get_catalog_entry(fault_category: str, request: Request):
    """Returns the admin-curated entry for a fault category, or 404 if none exists
    (in which case the driver app falls back to the AI-suggested parts/fees)."""
    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT fault_category, label, parts, service_fee_min, service_fee_max, notes, updated_at "
            "FROM spare_parts_catalog WHERE fault_category = $1",
            fault_category,
        )
    if not row:
        raise HTTPException(status_code=404, detail="No catalog override for this fault category")
    return _row_to_entry(row)
