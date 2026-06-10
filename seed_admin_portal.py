import asyncio
import asyncpg
import bcrypt
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Local-dev default DB (the postgres:password creds are the public docker-compose
# defaults); override with ADMIN_DATABASE_URL for any other environment.
DB_URL = os.getenv(
    "ADMIN_DATABASE_URL",
    "postgresql://postgres:password@localhost:5433/motofix_admin",
)

# Admin password comes from the environment — never hardcoded.
ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    sys.exit(
        "Missing SEED_ADMIN_PASSWORD. Set it in your .env before seeding, e.g.\n"
        "  SEED_ADMIN_PASSWORD=<choose-a-strong-password>"
    )


async def seed():
    conn = await asyncpg.connect(DB_URL)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id            SERIAL PRIMARY KEY,
            full_name     TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'admin',
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()

    await conn.execute("""
        INSERT INTO admins (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    """, "MOTOFIX Admin", "admin@motofix.ug", pw_hash, "admin")

    await conn.close()
    print("Admin seeded successfully into motofix_admin.")
    print()
    print("  Email   : admin@motofix.ug")
    print("  Password: (from SEED_ADMIN_PASSWORD env var)")

asyncio.run(seed())
