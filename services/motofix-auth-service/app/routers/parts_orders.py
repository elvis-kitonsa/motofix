# app/routers/parts_orders.py
# A driver's self-fix spare-parts orders. The actual dealer is a Google Places
# listing (not a platform account), so an "order" is a structured request the
# driver sends to the dealer via WhatsApp/SMS; we persist it here purely as the
# driver's own order history.

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Spare Parts Orders"])


async def _get_conn(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": True, "code": "DB_UNAVAILABLE",
                    "message": "Database connection pool not initialised", "status_code": 503},
        )
    return pool


class OrderPart(BaseModel):
    name: str
    price_min: int = 0
    price_max: int = 0
    qty: int = Field(1, ge=1)


class OrderCreate(BaseModel):
    fault_category: Optional[str] = None
    fault_label: Optional[str] = None
    parts: List[OrderPart] = Field(default_factory=list)
    dealer_name: Optional[str] = None
    dealer_phone: Optional[str] = None
    dealer_place_id: Optional[str] = None
    estimated_total_min: Optional[int] = None
    estimated_total_max: Optional[int] = None


def _row_to_order(row) -> dict:
    parts = row["parts"]
    if isinstance(parts, str):
        try:
            parts = json.loads(parts)
        except (ValueError, TypeError):
            parts = []
    return {
        "id": row["id"],
        "fault_category": row["fault_category"],
        "fault_label": row["fault_label"],
        "parts": parts or [],
        "dealer_name": row["dealer_name"],
        "dealer_phone": row["dealer_phone"],
        "dealer_place_id": row["dealer_place_id"],
        "estimated_total_min": row["estimated_total_min"],
        "estimated_total_max": row["estimated_total_max"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.post("/me/parts-orders", status_code=status.HTTP_201_CREATED, summary="Record a self-fix parts order")
async def create_order(
    body: OrderCreate,
    request: Request,
    user: dict = Depends(get_current_user),
):
    user_id = int(user["sub"])
    owner_role = user.get("role") or "driver"
    parts_json = json.dumps([p.model_dump() for p in body.parts])
    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO spare_part_orders
                (user_id, owner_role, fault_category, fault_label, parts, dealer_name, dealer_phone,
                 dealer_place_id, estimated_total_min, estimated_total_max, status)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, 'sent')
            RETURNING id, fault_category, fault_label, parts, dealer_name, dealer_phone,
                      dealer_place_id, estimated_total_min, estimated_total_max, status, created_at
            """,
            user_id, owner_role, body.fault_category, body.fault_label, parts_json,
            body.dealer_name, body.dealer_phone, body.dealer_place_id,
            body.estimated_total_min, body.estimated_total_max,
        )
    return _row_to_order(row)


@router.get("/me/parts-orders", summary="List my self-fix parts orders")
async def list_orders(request: Request, user: dict = Depends(get_current_user)):
    user_id = int(user["sub"])
    owner_role = user.get("role") or "driver"
    pool = await _get_conn(request)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, fault_category, fault_label, parts, dealer_name, dealer_phone,
                   dealer_place_id, estimated_total_min, estimated_total_max, status, created_at
            FROM spare_part_orders WHERE user_id = $1 AND owner_role = $2 ORDER BY created_at DESC
            """,
            user_id, owner_role,
        )
    return [_row_to_order(r) for r in rows]
