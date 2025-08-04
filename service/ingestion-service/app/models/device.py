# app/models/device.py
from sqlalchemy import Column, Integer, Text, TIMESTAMP, text
from sqlalchemy.sql import func
from app.database import Base

class Device(Base):
    __tablename__ = "devices"
    __table_args__ = {"schema": "thermo"}

    id = Column(Integer, primary_key=True, index=True)
    device_uid = Column(Text, unique=True, nullable=False)
    name = Column(Text)
    device_type = Column(Text)
    location = Column(Text)
    installed_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
