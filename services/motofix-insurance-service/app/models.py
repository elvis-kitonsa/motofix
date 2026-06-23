# app/models.py
# Database tables for the insurance service, described as Python classes (ORM models).
#   Claim       — an insurance claim a driver files (incident details + status).
#   ClaimPhoto  — photos attached to a claim; "ON DELETE CASCADE" means a claim's
#                 photos are automatically removed if the claim itself is deleted.

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True)
    reference = Column(String(20), unique=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    user_phone = Column(String(20), nullable=False)
    claim_type = Column(String(30), nullable=False)
    claim_type_label = Column(String(50), nullable=False)
    incident_date = Column(Date, nullable=False)
    incident_time = Column(String(10), nullable=False)
    location = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    injuries = Column(Boolean, nullable=True)
    third_party = Column(Boolean, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ClaimPhoto(Base):
    __tablename__ = "claim_photos"

    id = Column(Integer, primary_key=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    slot = Column(String(50), nullable=False)
    file_path = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
