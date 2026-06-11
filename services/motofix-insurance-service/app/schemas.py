from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ClaimPhoto(BaseModel):
    slot: str
    preview: str  # base64 data URL: "data:image/jpeg;base64,..."


class ClaimCreate(BaseModel):
    type: str = Field(..., description="accident | theft | fire | flood | vandalism | windscreen | other")
    type_label: str = Field(..., description="Human-readable label, e.g. 'Accident'")
    incident_date: date
    incident_time: str = Field(..., description="HH:MM format")
    location: str
    description: str
    injuries: Optional[bool] = None
    third_party: Optional[bool] = None
    insurer_id: Optional[str] = None
    insurer_name: Optional[str] = None
    photos: list[ClaimPhoto] = []


# ── Insurance applications (apply for cover) ────────────────────────────────────

class ApplicationCreate(BaseModel):
    insurer_id: str
    insurer_name: str
    cover_type: str = Field(..., description="third_party | third_party_fire_theft | comprehensive")
    cover_label: str
    vehicle_reg: str
    vehicle_make: Optional[str] = ""
    vehicle_model: Optional[str] = ""
    vehicle_year: Optional[str] = ""
    period: str = Field("1 year", description="Cover period, e.g. '1 year', '6 months'")
    notes: Optional[str] = ""


class ApplicationResponse(BaseModel):
    id: int
    reference: str
    user_id: int
    insurer_id: str
    insurer_name: str
    cover_type: str
    cover_label: str
    vehicle_reg: str
    vehicle_make: Optional[str] = ""
    vehicle_model: Optional[str] = ""
    vehicle_year: Optional[str] = ""
    period: str
    status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_record(cls, row: dict) -> "ApplicationResponse":
        return cls(
            id=row["id"], reference=row["reference"], user_id=row["user_id"],
            insurer_id=row["insurer_id"], insurer_name=row["insurer_name"],
            cover_type=row["cover_type"], cover_label=row["cover_label"],
            vehicle_reg=row["vehicle_reg"], vehicle_make=row.get("vehicle_make") or "",
            vehicle_model=row.get("vehicle_model") or "", vehicle_year=row.get("vehicle_year") or "",
            period=row["period"], status=row["status"],
            created_at=row["created_at"], updated_at=row["updated_at"],
        )


class ClaimPhotoOut(BaseModel):
    id: int
    slot: str
    file_path: str
    created_at: datetime


class ClaimResponse(BaseModel):
    id: int
    reference: str
    user_id: int
    claim_type: str
    claim_type_label: str
    incident_date: date
    incident_time: str
    location: str
    description: str
    injuries: Optional[bool]
    third_party: Optional[bool]
    insurer_id: Optional[str] = None
    insurer_name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    photos: list[ClaimPhotoOut] = []

    @classmethod
    def from_record(cls, row: dict, photos: list = None) -> "ClaimResponse":
        return cls(
            id=row["id"],
            reference=row["reference"],
            user_id=row["user_id"],
            claim_type=row["claim_type"],
            claim_type_label=row["claim_type_label"],
            incident_date=row["incident_date"],
            incident_time=row["incident_time"],
            location=row["location"],
            description=row["description"],
            injuries=row["injuries"],
            third_party=row["third_party"],
            insurer_id=row.get("insurer_id"),
            insurer_name=row.get("insurer_name"),
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            photos=[
                ClaimPhotoOut(
                    id=p["id"],
                    slot=p["slot"],
                    file_path=p["file_path"],
                    created_at=p["created_at"],
                )
                for p in (photos or [])
            ],
        )
