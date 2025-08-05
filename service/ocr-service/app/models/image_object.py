# app/models/image_object.py
from sqlalchemy import Column, BigInteger, Integer, Text, TIMESTAMP, Enum as SAEnum, JSON, ForeignKey, UniqueConstraint
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
    __table_args__ = (
        UniqueConstraint('minio_bucket', 'object_name', name='uq_minio_object'),
        {'schema': 'thermo'}
    )

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(
        Integer,
        ForeignKey("thermo.devices.id", ondelete="CASCADE"),
        nullable=False
    )
    recorded_at = Column(TIMESTAMP(timezone=True), nullable=False)
    minio_bucket = Column(Text, nullable=False)
    object_name = Column(Text, nullable=False)
    object_version = Column(Text)
    checksum = Column(Text)
    image_type = Column(
        Text,
        nullable=False,
        # database-side check ensures raw/processed
    )
    status = Column(
        SAEnum(ObjectStatus, name="object_status"),
        nullable=False,
        default=ObjectStatus.pending
    )
    metadata_json = Column(
        "metadata",
        JSON,
        default=dict,
        nullable=False
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

