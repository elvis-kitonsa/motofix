# app/database.py
# Async SQLAlchemy engine + session for ORM and Alembic.
# Runtime query code uses the raw asyncpg pool from main.py (via get_db in routers).

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

_DATABASE_URL = os.getenv("DATABASE_URL", "")

# SQLAlchemy async requires postgresql+asyncpg:// scheme
if _DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = _DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _DATABASE_URL.startswith("postgresql+asyncpg://"):
    ASYNC_DATABASE_URL = _DATABASE_URL
else:
    ASYNC_DATABASE_URL = _DATABASE_URL  # will fail loudly at startup if wrong

async_engine = create_async_engine(ASYNC_DATABASE_URL, echo=False, pool_pre_ping=True)

AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    FastAPI dependency — yields an async SQLAlchemy session.
    Used by new routers (driver, provider, admin).
    Existing routers (auth, users) continue using the asyncpg pool via main.py.
    """
    async with AsyncSessionLocal() as session:
        yield session
