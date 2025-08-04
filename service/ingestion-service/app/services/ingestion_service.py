# app/services/ingestion_service.py
import datetime
import hashlib
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.services.chunk_assembler import ChunkAssembler
from app.services.redis_client import RedisClient
from app.services.minio_uploader import MinIOUploader
from app.database import SessionLocal
from app.models.device import Device
from app.models.image_object import ImageObject, ObjectStatus

logger = logging.getLogger("ingestion_service")

# session per camera to generate a unique image_id when upstream only gives camera id
SESSION_TTL_SECONDS = 60  # ถ้า capture หนึ่งใช้เวลานาน เพิ่มค่านี้ได้


def get_or_create_session_for_camera(camera_uid: str) -> str:
    r = RedisClient.get_client()
    key = f"camera_session:{camera_uid}"
    session = r.get(key)
    if session:
        return session.decode() if isinstance(session, bytes) else session
    new_sess = str(uuid.uuid4())
    # เก็บไว้ชั่วคราว; หมดอายุแล้วถ้ามี capture ใหม่จะได้ session ใหม่
    r.set(key, new_sess, ex=SESSION_TTL_SECONDS)
    return new_sess


class IngestionService:
    def __init__(self):
        self.assembler = ChunkAssembler()
        self.uploader = MinIOUploader()

    def process_chunk_message(self, payload: dict, topic: str):
        # camera id ที่กล้องส่งมา (ยังไม่ใช่ image_id จริง)
        raw_camera_id = payload.get("id")
        try:
            _, camera_uid, _ = topic.split("/")
        except ValueError:
            camera_uid = raw_camera_id or "unknown"

        # กำหนด image_id: ถ้า publisher ส่ง image_id จริงๆ ให้ใช้, ถ้าไม่มีก็ fallback สร้าง session per camera
        image_id = payload.get("image_id")
        if not image_id:
            image_id = get_or_create_session_for_camera(camera_uid)

        index = int(payload.get("index", 0))
        total = int(payload.get("total", 0))
        data_b64 = payload.get("data")
        if not image_id or data_b64 is None:
            logger.warning("Invalid payload, missing image_id or data; payload=%s", payload)
            return

        # dedupe guard
        if self.assembler.already_processed(image_id):
            logger.info("Skipping already processed image %s (camera %s)", image_id, camera_uid)
            return

        # store chunk
        complete = self.assembler.add_chunk(image_id, index, total, data_b64)
        if not complete:
            logger.debug("Stored chunk %d/%d for image %s (camera %s)", index + 1, total, image_id, camera_uid)
            return  # ยังไม่ครบ

        lock_name = f"assemble:{image_id}"
        if not RedisClient.acquire_lock(lock_name, ttl=30):
            logger.info("Another worker is handling image %s, skipping", image_id)
            return

        try:
            image_bytes = self.assembler.assemble(image_id)
            if image_bytes is None:
                logger.error("Failed to assemble image %s", image_id)
                return

            recorded_at = datetime.datetime.utcnow()
            # ตั้งชื่อ object แบบ unique ต่อ capture; ใช้ camera_uid เพื่อจัดโฟลเดอร์
            object_name = f"{camera_uid}/{image_id}-{int(recorded_at.timestamp())}.jpg"
            checksum = hashlib.sha256(image_bytes).hexdigest()

            # upload to MinIO (จับ error พวก transient)
            try:
                upload_info = self.uploader.upload_raw_image(object_name, image_bytes)
            except Exception as e:
                logger.exception("Failed uploading image %s to MinIO: %s", image_id, e)
                return  # ไม่ mark processed เพื่อให้ retry ได้

            bucket = upload_info.get("bucket")
            stored_name = upload_info.get("object_name")
            object_version = upload_info.get("version")

            # persist to DB
            with SessionLocal() as db:
                # get or create device safely
                stmt = select(Device).where(Device.device_uid == camera_uid)
                try:
                    device = db.execute(stmt).scalars().first()
                    if not device:
                        device = Device(device_uid=camera_uid, name=camera_uid)
                        db.add(device)
                        db.commit()
                        db.refresh(device)
                except IntegrityError:
                    db.rollback()
                    device = db.execute(stmt).scalars().first()

                # insert image object idempotently
                image_obj = ImageObject(
                    device_id=device.id,
                    recorded_at=recorded_at,
                    minio_bucket=bucket,
                    object_name=stored_name,
                    object_version=object_version,
                    checksum=checksum,
                    image_type="raw",
                    status=ObjectStatus.pending,
                    metadata={"source_topic": topic} if hasattr(ImageObject, "metadata") else {"source_topic": topic},
                )
                db.add(image_obj)
                try:
                    db.commit()
                    logger.info(
                        "Saved image object %s for camera %s (image_id=%s)", stored_name, camera_uid, image_id
                    )
                except IntegrityError as e:
                    db.rollback()
                    logger.warning("Image object already exists (unique constraint) for image_id=%s: %s", image_id, e)

            # mark processed และลบ session mapping เพื่อให้ capture ถัดไปได้ image_id ใหม่
            self.assembler.mark_processed(image_id)
            try:
                r = RedisClient.get_client()
                r.delete(f"camera_session:{camera_uid}")
            except Exception:
                logger.debug("Failed clearing camera session for %s", camera_uid)
        finally:
            RedisClient.release_lock(lock_name)
