# app/services/minio_uploader.py
import io
import hashlib
import logging
import os
import time
from typing import Optional

from minio import Minio
from minio.error import S3Error
from app import config as config_module  # import module to be safe
from app.config import Config

logger = logging.getLogger("minio_uploader")


def _resolve_minio_hostport() -> str:
    # Prefer official helper if exists
    if hasattr(Config, "get_minio_endpoint_hostport"):
        try:
            return Config.get_minio_endpoint_hostport()
        except Exception:
            logger.warning("Config.get_minio_endpoint_hostport() failed, falling back")
    # Fallback: strip schema from MINIO_ENDPOINT env var
    ep = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    ep = ep.replace("http://", "").replace("https://", "")
    return ep


class MinIOUploader:
    def __init__(self):
        endpoint = _resolve_minio_hostport()
        secure = getattr(Config, "MINIO_SECURE", False)
        self.client = Minio(
            endpoint,
            access_key=getattr(Config, "MINIO_ROOT_USER", None),
            secret_key=getattr(Config, "MINIO_ROOT_PASSWORD", None),
            secure=secure,
        )
        # ensure bucket exists (เงียบ ๆ ถ้าแข่งกันสร้าง)
        bucket = getattr(Config, "MINIO_RAW_BUCKET", "thermo-raw")
        try:
            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)
        except S3Error as e:
            logger.warning("Error ensuring bucket exists (%s): %s", bucket, e)
        except Exception as e:
            logger.error("Unexpected error checking/creating bucket %s: %s", bucket, e)
            raise

    def upload_raw_image(
        self, object_name: str, data: bytes, content_type="image/jpeg", max_retries: int = 3
    ) -> dict:
        bucket = getattr(Config, "MINIO_RAW_BUCKET", "thermo-raw")
        checksum = hashlib.sha256(data).hexdigest()
        size = len(data)

        attempt = 0
        while attempt < max_retries:
            try:
                attempt += 1
                logger.debug(
                    "Uploading object %s to bucket %s (attempt %d)", object_name, bucket, attempt
                )
                data_stream = io.BytesIO(data)  # reset stream each try
                etag = self.client.put_object(
                    bucket_name=bucket,
                    object_name=object_name,
                    data=data_stream,
                    length=size,
                    content_type=content_type,
                )

                object_version: Optional[str] = None
                try:
                    stat = self.client.stat_object(bucket, object_name)
                    object_version = getattr(stat, "version_id", None)
                except Exception:
                    pass  # non-fatal if version info not available

                return {
                    "bucket": bucket,
                    "object_name": object_name,
                    "checksum": checksum,
                    "version": object_version,
                    "etag": etag,
                }
            except S3Error as e:
                logger.warning(
                    "S3Error on upload attempt %d for %s: %s", attempt, object_name, e
                )
                if attempt >= max_retries:
                    logger.error("Exceeded upload retries for %s", object_name)
                    raise
                time.sleep(2 ** attempt * 0.1)
            except Exception as e:
                logger.exception("Unexpected error uploading %s: %s", object_name, e)
                raise
