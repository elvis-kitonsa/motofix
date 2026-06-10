# motofix-core — Shared Infrastructure Package

**SDD Reference:** SDD Section 3.1

Shared package imported by all 6 backend microservices.

Contains:
- `models/`    — SQLAlchemy / asyncpg shared table definitions
- `schemas/`   — Shared Pydantic request/response schemas
- `security/`  — JWT creation & verification, password hashing (bcrypt)
- `deps/`      — Reusable FastAPI dependency injectors (get_db, get_current_user)
- `cors.py`    — Centralised CORS configuration

Install into each service with:
    pip install -e ../motofix-core
