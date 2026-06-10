# app/routers/mechanics.py

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
import asyncpg

router = APIRouter(prefix="/mechanics", tags=["Mechanics"])

# ────────────────────────────── SCHEMAS ──────────────────────────────

class MechanicBase(BaseModel):
    phone: str
    name: str
    location: str | None = None
    is_verified: bool = False
    rating: int = 0
    jobs_completed: int = 0


class MechanicCreate(MechanicBase):
    pass


class MechanicUpdate(BaseModel):
    phone: str | None = None
    name: str | None = None
    location: str | None = None
    is_verified: bool | None = None
    rating: int | None = None
    jobs_completed: int | None = None


class Mechanic(MechanicBase):
    id: int

    class Config:
        from_attributes = True  # For Pydantic v2 compatibility


# ────────────────────────────── DEPENDENCY ──────────────────────────────

async def get_db() -> asyncpg.Connection:
    from ..main import pool  # Import pool from main.py
    async with pool.acquire() as conn:
        yield conn


# ────────────────────────────── ENDPOINTS ──────────────────────────────

@router.post("/", response_model=Mechanic)
async def create(mechanic: MechanicCreate, db: asyncpg.Connection = Depends(get_db)):
    query = """
        INSERT INTO mechanics (phone, name, location, is_verified, rating, jobs_completed)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, phone, name, location, is_verified, rating, jobs_completed
    """
    result = await db.fetchrow(
        query,
        mechanic.phone,
        mechanic.name,
        mechanic.location,
        mechanic.is_verified,
        mechanic.rating,
        mechanic.jobs_completed
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create mechanic")
    return dict(result)


@router.get("/")
async def read_all(
    db: asyncpg.Connection = Depends(get_db),
    verified_only: Optional[bool] = Query(None),
    available_only: Optional[bool] = Query(None),
):
    """
    List mechanics. Supports verified_only and available_only filters.
    Returns extended fields required by the matching/scoring service:
    latitude, longitude, specialisations (array), avg_rating, rating_count, fcm_token.
    """
    conditions = []
    if verified_only:
        conditions.append("is_verified = true")
    if available_only:
        conditions.append("is_available = true")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = await db.fetch(f"""
        SELECT id, phone, full_name, location, latitude, longitude,
               specialty, is_available, is_verified, rating, total_ratings,
               jobs_completed, fcm_token
        FROM mechanics
        {where}
        ORDER BY id DESC
    """)

    result = []
    for r in rows:
        row = dict(r)
        # Normalise field names to what the scoring algorithm expects
        row["name"] = row.pop("full_name", None) or f"Mechanic {row['id']}"
        row["avg_rating"] = float(row.get("rating") or 0)
        row["rating_count"] = int(row.get("total_ratings") or 0)
        # Split specialty CSV into specialisations array
        spec = (row.get("specialty") or "").strip()
        row["specialisations"] = [s.strip() for s in spec.split(",") if s.strip()] if spec else []
        result.append(row)

    return result


@router.get("/{mechanic_id}", response_model=Mechanic)
async def read_one(mechanic_id: int, db: asyncpg.Connection = Depends(get_db)):
    query = """
        SELECT id, phone, name, location, is_verified, rating, jobs_completed
        FROM mechanics
        WHERE id = $1
    """
    result = await db.fetchrow(query, mechanic_id)
    if not result:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    return dict(result)


@router.patch("/{mechanic_id}", response_model=Mechanic)
async def update(
    mechanic_id: int,
    update: MechanicUpdate,
    db: asyncpg.Connection = Depends(get_db)
):
    data = update.dict(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Map Pydantic field names to actual DB column names
    COLUMN_MAP: dict = {}  # name column in DB is already "name"

    set_parts = []
    values = []
    for idx, (key, value) in enumerate(data.items(), start=1):
        col = COLUMN_MAP.get(key, key)
        set_parts.append(f"{col} = ${idx}")
        values.append(value)

    values.append(mechanic_id)
    query = f"""
        UPDATE mechanics
        SET {', '.join(set_parts)}
        WHERE id = ${len(values)}
        RETURNING id, phone, name, location, is_verified, rating, jobs_completed
    """
    result = await db.fetchrow(query, *values)
    if not result:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    return dict(result)


@router.delete("/{mechanic_id}")
async def delete(mechanic_id: int, db: asyncpg.Connection = Depends(get_db)):
    query = "DELETE FROM mechanics WHERE id = $1 RETURNING id"
    result = await db.fetchrow(query, mechanic_id)
    if not result:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    return {"detail": "Mechanic deleted successfully"}