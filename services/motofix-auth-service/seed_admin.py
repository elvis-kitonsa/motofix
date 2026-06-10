import asyncio
import asyncpg
import bcrypt
import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _require(var: str) -> str:
    """Read a required secret from the environment, or exit with guidance."""
    val = os.getenv(var)
    if not val:
        sys.exit(
            f"Missing {var}. Set it in your .env before seeding, e.g.\n"
            f"  {var}=<choose-a-strong-password>"
        )
    return val


# Seed-account passwords come from the environment — never hardcoded.
ADMIN_PASSWORD = _require("SEED_ADMIN_PASSWORD")
MECHANIC_PASSWORD = _require("SEED_MECHANIC_PASSWORD")


async def seed():
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

    # ── Admin ──────────────────────────────────────────────────────────────────
    admin_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
    await conn.execute("""
        INSERT INTO admins (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING
    """, "MOTOFIX Admin", "admin@motofix.ug", admin_hash, "admin")
    print("Admin:              admin@motofix.ug  (password from SEED_ADMIN_PASSWORD)")

    pw_hash = bcrypt.hashpw(MECHANIC_PASSWORD.encode(), bcrypt.gensalt()).decode()

    # ── Mechanic — SPN-0001 (primary test account) ────────────────────────────
    await conn.execute("""
        INSERT INTO mechanics
            (full_name, phone, location, latitude, longitude,
             specialty, provider_type, vehicle_type,
             password_hash, spn, is_verified, is_available,
             rating, total_ratings, jobs_completed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,FALSE,4.8,30,75)
        ON CONFLICT (phone) DO UPDATE SET
            full_name     = EXCLUDED.full_name,
            spn           = EXCLUDED.spn,
            password_hash = EXCLUDED.password_hash,
            specialty     = EXCLUDED.specialty,
            rating        = EXCLUDED.rating,
            total_ratings = EXCLUDED.total_ratings,
            jobs_completed= EXCLUDED.jobs_completed,
            is_verified   = TRUE
    """,
        "Motofix Provider", "+256700000001", "Kampala",
        0.3476, 32.5825,
        "Engine Diagnostics, Electrical Systems, Brakes & Suspension",
        "mechanic", "motorcycle",
        pw_hash, "SPN-0001",
    )
    print("Mechanic:           SPN-0001  (Motofix Provider)")

    # ── Mechanic — Bbosa Allan ─────────────────────────────────────────────────
    mech_hash = bcrypt.hashpw(MECHANIC_PASSWORD.encode(), bcrypt.gensalt()).decode()
    await conn.execute("""
        INSERT INTO mechanics
            (full_name, phone, location, latitude, longitude,
             specialty, provider_type, vehicle_type,
             password_hash, spn, is_verified, is_available,
             rating, total_ratings, jobs_completed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,FALSE,4.7,23,61)
        ON CONFLICT (phone) DO UPDATE SET
            full_name     = EXCLUDED.full_name,
            spn           = EXCLUDED.spn,
            password_hash = EXCLUDED.password_hash,
            specialty     = EXCLUDED.specialty,
            rating        = EXCLUDED.rating,
            total_ratings = EXCLUDED.total_ratings,
            jobs_completed= EXCLUDED.jobs_completed,
            is_verified   = TRUE
    """,
        "Bbosa Allan", "+256772410033", "Kireka, Kampala",
        0.3381, 32.6469,
        "Engine Diagnostics, Electrical Systems, Brakes & Suspension, Transmission",
        "mechanic", "car",
        mech_hash, "SPN-0042",
    )
    print("Mechanic:           SPN-0042  (Bbosa Allan)")

    # ── Towing Provider — Kiggundu Automotives ────────────────────────────────
    tow_hash = bcrypt.hashpw(MECHANIC_PASSWORD.encode(), bcrypt.gensalt()).decode()
    await conn.execute("""
        INSERT INTO towing_providers
            (full_name, phone, location, latitude, longitude,
             vehicle_capacity, password_hash, spn, is_verified, is_available,
             rating, total_ratings, jobs_completed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,FALSE,4.5,18,44)
        ON CONFLICT (phone) DO UPDATE SET
            full_name        = EXCLUDED.full_name,
            spn              = EXCLUDED.spn,
            password_hash    = EXCLUDED.password_hash,
            vehicle_capacity = EXCLUDED.vehicle_capacity,
            rating           = EXCLUDED.rating,
            total_ratings    = EXCLUDED.total_ratings,
            jobs_completed   = EXCLUDED.jobs_completed,
            is_verified      = TRUE
    """,
        "Kiggundu Automotives", "+256701885521", "Ntinda, Kampala",
        0.3540, 32.6201,
        3,
        tow_hash, "SPN-0021",
    )
    print("Towing Provider:    SPN-0021  (Kiggundu Automotives)")

    await conn.close()
    print("\n── Seeded accounts (passwords from SEED_* env vars) ────────────")
    print("Admin:           admin@motofix.ug")
    print("Mechanic:        SPN-0001, SPN-0042")
    print("Towing provider: SPN-0021")

asyncio.run(seed())
