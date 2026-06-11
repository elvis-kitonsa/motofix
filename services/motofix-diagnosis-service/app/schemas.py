from pydantic import BaseModel, Field
from typing import List, Optional


class TextDiagnosisRequest(BaseModel):
    description: str = Field(..., description="Driver's description of the vehicle fault")


class PartEstimate(BaseModel):
    name: str = Field(..., description="Spare part name, e.g. 'Tube' or 'Car battery (NS60)'")
    price_min: int = Field(0, description="Lower bound of typical part price in UGX")
    price_max: int = Field(0, description="Upper bound of typical part price in UGX")


class DiagnosisResult(BaseModel):
    fault_category: str = Field(..., description="Classified fault category")
    fault_description: str = Field(..., description="Brief technical description of the fault")
    provider_type: str = Field(..., description="mechanic | towing_provider | spare_parts_dealer | ambulance")
    severity: str = Field(..., description="low | medium | high | critical")
    confidence: float = Field(..., description="Confidence score 0.0–1.0")
    recommended_actions: List[str] = Field(..., description="Immediate steps the driver should take")
    follow_up_questions: Optional[List[str]] = Field(None, description="Questions to ask if more info is needed")
    # Spare-parts guidance — populated for parts-fixable faults (AI estimate; an
    # admin catalog entry for the fault_category overrides these in the driver app).
    required_parts: Optional[List[PartEstimate]] = Field(
        None, description="Parts the driver likely needs to buy to fix this themselves, with UGX price ranges")
    service_fee_min: Optional[int] = Field(None, description="Typical fitting/labour fee — low end (UGX)")
    service_fee_max: Optional[int] = Field(None, description="Typical fitting/labour fee — high end (UGX)")
    # Repair-vs-replace: cost if the fault can be FIXED without buying a new part (labour only). 0 if not repairable.
    repair_fee_min: Optional[int] = Field(None, description="Minor on-site fix (no new part) — low end (UGX)")
    repair_fee_max: Optional[int] = Field(None, description="Minor on-site fix (no new part) — high end (UGX)")
    # Image relevance (for /diagnose/image): False if the photo isn't a vehicle or doesn't match the issue.
    image_relevant: Optional[bool] = Field(None, description="Whether an uploaded photo is relevant to the issue")
    image_feedback: Optional[str] = Field(None, description="Message to the driver when the photo is not usable")


class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Full conversation history including the latest user message")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="Assistant's response to the driver")
    diagnosis_ready: bool = Field(..., description="True when enough information has been gathered for a diagnosis")
    diagnosis: Optional[DiagnosisResult] = Field(None, description="Final diagnosis — populated when diagnosis_ready is true")


class GuidedAnswer(BaseModel):
    question: str = Field(..., description="The question that was asked")
    answer: str = Field(..., description="The driver's answer (chosen option or free text)")


class GuidedDiagnoseRequest(BaseModel):
    answers: List[GuidedAnswer] = Field(default_factory=list, description="Questions asked and answers given so far")


class FuelAdvisorRequest(BaseModel):
    car_model: str = Field(..., description="Uganda car model e.g. 'Toyota Ipsum'")
    fuel_type: str = Field(..., description="regular_petrol | super_petrol | diesel | kerosene")


class NearbyStationsRequest(BaseModel):
    lat: float = Field(..., description="Driver latitude")
    lng: float = Field(..., description="Driver longitude")


# ── MOTOBOT spare-parts pricing ────────────────────────────────────────────────

class PartPriceRequest(BaseModel):
    items: List[str] = Field(..., description="Spare-part names the driver wants to buy")


class PartPrice(BaseModel):
    name: str
    price_min: int = 0          # overall range (min used/new) — kept for order history
    price_max: int = 0
    new_min: int = 0
    new_max: int = 0
    used_min: int = 0
    used_max: int = 0
    note: Optional[str] = None


class PartPriceResponse(BaseModel):
    items: List[PartPrice]
    currency: str = "UGX"
