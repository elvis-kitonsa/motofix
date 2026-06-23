# app/services/rate_limit.py
# Stops abuse by limiting how often the same action can be done in a short time —
# e.g. "no more than 5 OTP requests from one phone per 10 minutes". This protects
# against spam, brute-forcing codes, and runaway SMS costs.
#
# How it works: every attempt is logged as a row in the rate_limit_buckets table.
# To check the limit we just count recent rows for that "key" (e.g. the phone number)
# and reject the request with a 429 error if there are already too many.

from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status


async def check_rate_limit(
    conn,
    key: str,                 # what we're limiting, e.g. "otp:+256700000000"
    max_attempts: int,        # how many are allowed within the window
    window_seconds: int,      # the length of the time window, in seconds
    message: str = "Too many requests. Please try again later.",
):
    """Raise a 429 'too many requests' error if `key` has been used too many times
    recently. Call record_attempt() afterwards to log each allowed attempt."""
    # Only count attempts newer than (now - window): older ones no longer matter.
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
    """Log one attempt for `key` (a row with the current time) so check_rate_limit
    can count it next time."""
    await conn.execute(
        "INSERT INTO rate_limit_buckets (key) VALUES ($1)", key
    )
