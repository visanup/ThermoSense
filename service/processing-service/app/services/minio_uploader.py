# service/processing-service/app/services/minio_uploader.py

from minio import Minio
from minio.error import S3Error
from app.config import Config
from app.utils.logger import get_logger
from app.utils.retry import retry

logger = get_logger("minio_uploader")


class MinioUploader:
    def __init__(self):
        endpoint = Config.get_minio_endpoint_hostport()
        self.client = Minio(
            endpoint=endpoint,
            access_key=Config.MINIO_ROOT_USER,
            secret_key=Config.MINIO_ROOT_PASSWORD,
            secure=Config.MINIO_SECURE,
        )
        # Ensure buckets exist at init
        try:
            self.ensure_buckets()
        except Exception as e:
            logger.warning("Failed to ensure buckets on init: %s", e)

    @retry(total_tries=3, initial_delay=1.0, backoff=2.0)
    def ensure_buckets(self):
        for bucket in (Config.MINIO_RAW_BUCKET, Config.MINIO_PROCESSED_BUCKET):
            try:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    logger.info("Created missing bucket: %s", bucket)
                else:
                    logger.debug("Bucket exists: %s", bucket)
            except S3Error as e:
                logger.warning("Error checking/creating bucket %s: %s", bucket, e)
                raise

    @retry(total_tries=3, initial_delay=0.5, backoff=2.0)
    def download_raw(self, object_name: str) -> bytes:
        logger.info("Downloading raw object %s from bucket %s", object_name, Config.MINIO_RAW_BUCKET)
        try:
            obj = self.client.get_object(Config.MINIO_RAW_BUCKET, object_name)
            data = obj.read()
            obj.close()
            obj.release_conn()
            logger.info("Downloaded raw object %s (%d bytes)", object_name, len(data))
            return data
        except Exception as e:
            logger.exception("Failed to download raw object %s", object_name)
            raise

    @retry(total_tries=3, initial_delay=0.5, backoff=2.0)
    def upload_processed(self, object_name: str, data: bytes, content_type: str = "image/jpeg"):
        logger.info("Uploading processed object %s to bucket %s", object_name, Config.MINIO_PROCESSED_BUCKET)
        try:
            from io import BytesIO

            stream = BytesIO(data)
            self.client.put_object(
                bucket_name=Config.MINIO_PROCESSED_BUCKET,
                object_name=object_name,
                data=stream,
                length=len(data),
                content_type=content_type,
            )
            logger.info("Uploaded processed object %s (%d bytes)", object_name, len(data))
        except Exception as e:
            logger.exception("Failed to upload processed object %s", object_name)
            raise
