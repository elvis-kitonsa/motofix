"""add_auth_service_full_schema

Revision ID: 0002
Revises:
Create Date: 2026-04-13

Adds:
  - mechanics table
  - towing_providers table
  - admins table
  - otp_store table
  - token_blacklist table
  - system_logs table
  - Alters users table: adds fcm_token, ensures created_at present
"""

from alembic import op
import sqlalchemy as sa

# ── Revision ───────────────────────────────────────────────────────────────────
revision = "0002"
down_revision = None   # set to previous revision ID if one exists
branch_labels = None
depends_on = None


def upgrade():
    # ── users (alter only — table already exists) ──────────────────────────────
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS fcm_token  TEXT,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    """)

    # ── mechanics ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS mechanics (
            id             SERIAL PRIMARY KEY,
            full_name      TEXT NOT NULL,
            phone          TEXT UNIQUE NOT NULL,
            location       TEXT NOT NULL,
            latitude       DOUBLE PRECISION NOT NULL DEFAULT 0,
            longitude      DOUBLE PRECISION NOT NULL DEFAULT 0,
            specialty      TEXT,
            provider_type  TEXT NOT NULL DEFAULT 'mechanic',
            vehicle_type   TEXT DEFAULT 'boda',
            password_hash  TEXT NOT NULL,
            is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
            is_available   BOOLEAN NOT NULL DEFAULT FALSE,
            rating         DOUBLE PRECISION NOT NULL DEFAULT 0,
            total_ratings  INTEGER NOT NULL DEFAULT 0,
            jobs_completed INTEGER NOT NULL DEFAULT 0,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── towing_providers ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS towing_providers (
            id               SERIAL PRIMARY KEY,
            full_name        TEXT NOT NULL,
            phone            TEXT UNIQUE NOT NULL,
            location         TEXT NOT NULL,
            latitude         DOUBLE PRECISION NOT NULL DEFAULT 0,
            longitude        DOUBLE PRECISION NOT NULL DEFAULT 0,
            vehicle_capacity INTEGER DEFAULT 1,
            password_hash    TEXT NOT NULL,
            is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
            is_available     BOOLEAN NOT NULL DEFAULT FALSE,
            rating           DOUBLE PRECISION NOT NULL DEFAULT 0,
            total_ratings    INTEGER NOT NULL DEFAULT 0,
            jobs_completed   INTEGER NOT NULL DEFAULT 0,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── admins ─────────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id            SERIAL PRIMARY KEY,
            full_name     TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'admin',
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── otp_store ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS otp_store (
            id         SERIAL PRIMARY KEY,
            phone      TEXT NOT NULL,
            otp_code   VARCHAR(6) NOT NULL,
            attempts   INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_otp_store_phone ON otp_store (phone)"
    )

    # ── token_blacklist ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS token_blacklist (
            id         SERIAL PRIMARY KEY,
            token_hash TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist (token_hash)"
    )

    # ── system_logs ────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id          SERIAL PRIMARY KEY,
            event_type  TEXT NOT NULL,
            user_id     INTEGER,
            mechanic_id INTEGER,
            request_id  INTEGER,
            description TEXT DEFAULT '',
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS system_logs")
    op.execute("DROP TABLE IF EXISTS token_blacklist")
    op.execute("DROP TABLE IF EXISTS otp_store")
    op.execute("DROP TABLE IF EXISTS admins")
    op.execute("DROP TABLE IF EXISTS towing_providers")
    op.execute("DROP TABLE IF EXISTS mechanics")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS fcm_token")
