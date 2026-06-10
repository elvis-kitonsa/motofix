# app/schemas/driver.py

from pydantic import BaseModel
from typing import Optional


class DriverRegisterRequest(BaseModel):
    phone: str
    full_name:    Optional[str] = None
    number_plate: Optional[str] = None


class OTPVerifyRequest(BaseModel):
    phone: str
    otp_code: str


class DriverOut(BaseModel):
    id: int
    phone: str
    full_name: Optional[str]
    role: str
    number_plate: Optional[str] = None

    class Config:
        from_attributes = True


class DriverLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: DriverOut


# ── Legacy aliases (kept for backwards compat with routers/auth.py) ───────────

class PhoneRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str
    full_name: Optional[str] = None
    role: str = "customer"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    phone: str
    full_name: Optional[str]
    role: str
    number_plate: Optional[str] = None


    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    number_plate: Optional[str] = None


class FcmTokenUpdate(BaseModel):
    fcm_token: str
