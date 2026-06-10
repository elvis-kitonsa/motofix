# app/schemas/common.py

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: bool = True
    code: str
    message: str
    status_code: int


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
