from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status


async def check_rate_limit(
    conn,
    key: str,
    max_attempts: int,
    window_seconds: int,
    message: str = "Too many requests. Please try again later.",
):
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM rate_limit_buckets WHERE key = $1 AND created_at > $2",
        key, cutoff,
    )
    if count >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": True,
                "code": "RATE_LIMITED",
                "message": message,
                "status_code": 429,
            },
        )


async def record_attempt(conn, key: str):
    await conn.execute(
        "INSERT INTO rate_limit_buckets (key) VALUES ($1)", key
    )
