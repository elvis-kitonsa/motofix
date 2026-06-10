# app/schemas/admin.py

from pydantic import BaseModel, EmailStr
from typing import Optional


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut
