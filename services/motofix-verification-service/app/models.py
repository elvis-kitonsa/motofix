# motfix-mechanic-service: app/models.py

from sqlalchemy import Column, Integer, String, Float, Boolean
from .database import Base

class Mechanic(Base):
    __tablename__ = "mechanics"

    id            = Column(Integer, primary_key=True, index=True)
    full_name          = Column(String, index=True)
    phone         = Column(String, unique=True, index=True)
    location      = Column(String)
    latitude      = Column(Float, nullable=True)
    longitude     = Column(Float, nullable=True)
    specialty     = Column(String)           # Fuel Delivery, Towing, Repair...
    rating        = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    is_available  = Column(Boolean, default=True)
    vehicle_type  = Column(String, default="boda")  # boda, car, truck