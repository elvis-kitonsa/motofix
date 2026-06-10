# app/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timedelta
import os
import jwt
import bcrypt as bcrypt_lib
from passlib.context import CryptContext
from typing import Optional

from app.db import get_db

router = APIRouter(prefix="/api", tags=["auth"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("ADMIN_JWT_SECRET", "my_very_long_random_secret_1234567890")
ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES will be read from env at token creation time if overridden
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ADMIN_TOKEN_EXPIRE_MINUTES", "240"))

class LoginIn(BaseModel):
    username: Optional[str] = "admin"
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

def verify_password(plain_password: str) -> bool:
    # Read env vars at call time so tests can monkeypatch them before calling
    admin_hash = os.getenv("ADMIN_PASSWORD_HASH")
    admin_pw = os.getenv("ADMIN_PASSWORD")
    if admin_hash:
        return pwd_ctx.verify(plain_password, admin_hash)
    if admin_pw:
        return plain_password == admin_pw
    return False

def create_access_token(*, data: dict, expires_delta: timedelta):
    # Read secret at call time to respect test monkeypatching or runtime env changes
    secret = os.getenv("ADMIN_JWT_SECRET", SECRET_KEY)
    alg = ALGORITHM
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=alg)

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn):
    if not verify_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(data={"sub": "admin", "role": "admin"}, expires_delta=access_token_expires)
    return {"access_token": token, "token_type": "bearer"}


class AdminLoginIn(BaseModel):
    email: str
    password: str


@router.post("/login/admin")
async def login_admin(payload: AdminLoginIn, db=Depends(get_db)):
    """Email + password admin login backed by the admins table."""
    row = await db.fetchrow(
        "SELECT id, full_name, email, role, password_hash FROM admins WHERE lower(email) = $1",
        payload.email.lower().strip(),
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    try:
        ok = bcrypt_lib.checkpw(payload.password.encode(), row["password_hash"].encode())
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": str(row["id"]), "email": row["email"], "role": "admin"},
        expires_delta=expires,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "admin": {"id": row["id"], "full_name": row["full_name"], "email": row["email"], "role": row["role"]},
    }