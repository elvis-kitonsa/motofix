# app/schemas/__init__.py
# Re-exports every schema so other modules can do:
#   from app.schemas import DriverOut, ProviderLoginResponse, AdminLoginRequest, ...

from app.schemas.common import ErrorResponse, SuccessResponse

from app.schemas.driver import (
    DriverRegisterRequest,
    OTPVerifyRequest,
    DriverOut,
    DriverLoginResponse,
    # Legacy aliases
    PhoneRequest,
    OTPVerify,
    Token,
    UserOut,
    UserProfileUpdate,
    FcmTokenUpdate,
)

from app.schemas.provider import (
    ProviderRegisterRequest,
    ProviderLoginRequest,
    ProviderOut,
    ProviderLoginResponse,
    VerifyProviderRequest,
)

from app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminOut,
)

__all__ = [
    # common
    "ErrorResponse",
    "SuccessResponse",
    # driver
    "DriverRegisterRequest",
    "OTPVerifyRequest",
    "DriverOut",
    "DriverLoginResponse",
    # driver legacy
    "PhoneRequest",
    "OTPVerify",
    "Token",
    "UserOut",
    "UserProfileUpdate",
    "FcmTokenUpdate",
    # provider
    "ProviderRegisterRequest",
    "ProviderLoginRequest",
    "ProviderOut",
    "ProviderLoginResponse",
    "VerifyProviderRequest",
    # admin
    "AdminLoginRequest",
    "AdminLoginResponse",
    "AdminOut",
]
