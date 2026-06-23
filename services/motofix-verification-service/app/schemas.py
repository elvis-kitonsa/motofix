# motofix-mechanics-service: app/schemas.py
# The shapes of mechanic data the API accepts and returns (validated by FastAPI).
# These define which fields are required vs optional when creating or updating a mechanic.

from pydantic import BaseModel
from typing import Optional


class MechanicCreate(BaseModel):
    full_name: str
    phone: str
    location: str
    specialty: str
    vehicle_type: str = "boda"


class MechanicUpdate(BaseModel):
    is_available: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class Mechanic(BaseModel):
    id: int
    full_name: str
    phone: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialty: str
    rating: float
    total_ratings: int
    is_available: bool
    vehicle_type: str

    class Config:
        from_attributes = True