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
    photos: list[ClaimPhoto] = []


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
