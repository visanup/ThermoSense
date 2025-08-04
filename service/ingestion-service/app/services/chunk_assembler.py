# app/services/chunk_assembler.py
import base64
import time
import logging
from typing import Optional, List

from app.services.redis_client import RedisClient

logger = logging.getLogger("chunk_assembler")

# TTL สำหรับ chunk partials / metadata (ถ้าไม่ครบจะหายไปเอง)
CHUNK_TTL_SECONDS = 300  # 5 นาที
PROCESSED_TTL_SECONDS = 3600  # เก็บว่า process เสร็จแล้ว 1 ชั่วโมง

def _chunks_key(image_id: str) -> str:
    return f"image_chunks:{image_id}"

def _meta_key(image_id: str) -> str:
    return f"image_meta:{image_id}"

def _processed_key(image_id: str) -> str:
    return f"processed:{image_id}"


class ChunkAssembler:
    def __init__(self):
        self.redis = RedisClient.get_client()

    def already_processed(self, image_id: str) -> bool:
        return bool(self.redis.exists(_processed_key(image_id)))

    def mark_processed(self, image_id: str):
        # ตั้ง flag ว่าเสร็จแล้ว พร้อม TTL
        try:
            self.redis.set(_processed_key(image_id), "1", ex=PROCESSED_TTL_SECONDS)
            # ล้าง chunk ข้างหลังถ้าต้องการ (optional)
            self.redis.delete(_chunks_key(image_id))
            self.redis.delete(_meta_key(image_id))
        except Exception as e:
            logger.warning("Failed to mark processed for %s: %s", image_id, e)

    def add_chunk(self, image_id: str, index: int, total: int, data_b64: str) -> bool:
        """
        เก็บ chunk, คืนค่า True ถ้าครบทั้งหมดแล้ว (พร้อมประกอบ)
        """
        pipe = self.redis.pipeline()
        chunks_key = _chunks_key(image_id)
        meta_key = _meta_key(image_id)

        # ถ้าเพิ่งเริ่ม: บันทึก total และ last_update
        existing_total = self.redis.hget(meta_key, "total")
        if existing_total is None:
            pipe.hset(meta_key, mapping={"total": total, "last_update": int(time.time())})
        else:
            # ถ้ามี total อยู่แล้ว แต่ไม่ตรง ให้ log (แต่เอา original)
            try:
                existing_total_int = int(existing_total)
                if existing_total_int != total:
                    logger.warning(
                        "Mismatch total for image %s: previous=%s new=%s", image_id, existing_total_int, total
                    )
            except Exception:
                pass
            pipe.hset(meta_key, "last_update", int(time.time()))

        # เก็บ chunk (field name เป็น index)
        pipe.hset(chunks_key, index, data_b64)

        # ตั้ง expiration ทั้งคู่ (refresh)
        pipe.expire(chunks_key, CHUNK_TTL_SECONDS)
        pipe.expire(meta_key, CHUNK_TTL_SECONDS)

        pipe.execute()

        # ตรวจว่าครบหรือยัง
        stored = self.redis.hlen(chunks_key)
        try:
            needed = int(self.redis.hget(meta_key, "total"))
        except Exception:
            needed = total  # fallback

        logger.debug(
            "Image %s chunk %d/%d stored (received=%d)", image_id, index + 1, needed, stored
        )

        return stored >= needed

    def assemble(self, image_id: str) -> Optional[bytes]:
        """
        รวมชิ้นส่วนเป็นภาพเดียว ถ้าครบแล้ว คืน image bytes ถ้าไม่ครบคืน None
        """
        chunks_key = _chunks_key(image_id)
        meta_key = _meta_key(image_id)

        if not self.redis.exists(meta_key):
            logger.error("No metadata for image %s; cannot assemble", image_id)
            return None

        try:
            total = int(self.redis.hget(meta_key, "total"))
        except Exception:
            logger.error("Invalid total in metadata for image %s", image_id)
            return None

        stored = self.redis.hlen(chunks_key)
        if stored < total:
            logger.debug("Image %s incomplete: have %d / %d", image_id, stored, total)
            return None

        # ดึงทุก chunk ตาม index เรียง
        raw_chunks = self.redis.hgetall(chunks_key)  # keys are bytes of index or str
        # Normalize keys to int
        indexed: List[Optional[str]] = [None] * total
        for key, val in raw_chunks.items():
            try:
                idx = int(key)
                indexed[idx] = val.decode() if isinstance(val, bytes) else val
            except Exception:
                logger.warning("Non-int chunk key for image %s: %s", image_id, key)

        if any(c is None for c in indexed):
            logger.error("Missing some chunks for image %s even though counts match", image_id)
            return None

        # รวม base64 แล้ว decode
        try:
            full_bytes = b"".join(base64.b64decode(c) for c in indexed)
            return full_bytes
        except Exception as e:
            logger.exception("Failed to decode/assemble image %s: %s", image_id, e)
            return None

    def cleanup_stale(self, max_age_seconds: int = CHUNK_TTL_SECONDS):
        """
        ล้าง partials เก่าที่ last_update เก่าเกิน (ต้องเรียกเป็น periodical ถ้าต้องการ)
        """
        # ถ้าอยาก implement: scan สำหรับ meta keys แล้วลบที่เก่า
        for key in self.redis.scan_iter("image_meta:*"):
            try:
                meta = self.redis.hgetall(key)
                last_update = int(meta.get(b"last_update", 0) if isinstance(meta.get(b"last_update", 0), bytes) else meta.get("last_update", 0))
                image_id = key.decode().split(":", 1)[1] if isinstance(key, bytes) else key.split(":", 1)[1]
                if time.time() - last_update > max_age_seconds:
                    logger.info("Cleaning stale partial image %s", image_id)
                    self.redis.delete(_chunks_key(image_id))
                    self.redis.delete(_meta_key(image_id))
            except Exception:
                continue
