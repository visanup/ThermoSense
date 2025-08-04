# app/models/image_object.py
from sqlalchemy import Column, BigInteger, Integer, Text, TIMESTAMP, Enum, JSON, ForeignKey
from sqlalchemy.sql import func
import enum
from app.database import Base

class ObjectStatus(enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class ImageObject(Base):
    __tablename__ = "image_objects"
    __table_args__ = {"schema": "thermo"}

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("thermo.devices.id", ondelete="CASCADE"), nullable=False)
    recorded_at = Column(TIMESTAMP(timezone=True), nullable=False)
    minio_bucket = Column(Text, nullable=False)
    object_name = Column(Text, nullable=False)
    object_version = Column(Text)
    checksum = Column(Text)
    image_type = Column(Text, nullable=False)  # 'raw' or 'processed'
    status = Column(Enum(ObjectStatus, name="object_status"), nullable=False, default=ObjectStatus.pending)
    metadata_json = Column("metadata", JSON, default={})  # <- ชื่อ attribute ต่างจาก reserved word
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

