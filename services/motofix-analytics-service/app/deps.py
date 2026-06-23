# app/deps.py
# The "admins only" gatekeeper for this service. Add verify_admin_token as a
# dependency on any endpoint and it will reject anyone whose token is missing,
# invalid, or not an admin — so reporting data is never exposed to regular users.

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os

security = HTTPBearer()

SECRET_KEY = os.getenv("ADMIN_JWT_SECRET", "my_very_long_random_secret_1234567890")  # set this in Render
ALGORITHM = "HS256"

def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Read the token from the request, confirm it's genuine, and require role == "admin".
    # Returns the token contents on success; otherwise raises 401 (bad token) or 403 (not admin).
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload