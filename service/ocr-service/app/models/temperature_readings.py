# /app/models/temperature_readings.py
from sqlalchemy import Column, BigInteger, Integer, Numeric, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base

class TemperatureReading(Base):
    __tablename__ = "temperature_readings"
    __table_args__ = (
        UniqueConstraint('device_id', 'recorded_at', name='uq_device_time'),
        {'schema': 'thermo'}
    )

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(
        Integer,
        ForeignKey("thermo.devices.id", ondelete="CASCADE"),
        nullable=False
    )
    recorded_at = Column(TIMESTAMP(timezone=True), nullable=False)
    temperature = Column(Numeric(6, 3), nullable=False)
    raw_image_id = Column(
        BigInteger,
        ForeignKey("thermo.image_objects.id"),
        nullable=True
    )
    processed_image_id = Column(
        BigInteger,
        ForeignKey("thermo.image_objects.id"),
        nullable=True
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )