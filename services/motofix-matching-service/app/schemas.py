from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class MatchRequest(BaseModel):
    request_id: Optional[int] = Field(None, description="Service request ID (used for dispatch tracking and re-dispatch)")
    latitude: float = Field(..., description="Breakdown latitude")
    longitude: float = Field(..., description="Breakdown longitude")
    service_type: str = Field(..., description="Type of service needed, e.g. 'tyre change', 'towing', 'engine repair'")
    excluded_mechanic_ids: Optional[List[int]] = Field(
        default_factory=list,
        description="IDs of mechanics already tried for this request (manual override; DB history is also used automatically)",
    )
    top_n: Optional[int] = Field(5, description="Maximum number of candidates to return", ge=1, le=20)


class MechanicCandidate(BaseModel):
    mechanic_id: int
    mechanic_name: str
    phone: Optional[str]
    fcm_token: Optional[str] = None
    distance_km: float
    total_score: float
    score_breakdown: Dict[str, float]
    weights: Dict[str, float]


class MatchResponse(BaseModel):
    request_id: Optional[int]
    candidates: List[MechanicCandidate]
    total_eligible: int


class DispatchOutcome(BaseModel):
    mechanic_id: int
    outcome: str = Field(..., description="One of: accepted, declined, expired")
