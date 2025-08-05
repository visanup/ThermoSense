# app/api/endpoints.py

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.utils.logger import get_logger
from app.utils.retry import retry
from app.config import Config
import pika
from minio import S3Error
import time

from app.services.minio_uploader import MinioUploader  # ปรับให้ตรงกับโครงสร้างจริง

logger = get_logger("endpoints")
router = APIRouter()

# แยก instance เพื่อ reuse
_minio_uploader = MinioUploader()


@retry(total_tries=2, initial_delay=0.5, backoff=1.5)
def check_rabbitmq() -> dict:
    result = {"ok": False, "detail": None}
    try:
        url = Config.get_rabbitmq_url()
        params = pika.URLParameters(url)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        # เช็กว่า connect ได้ (ไม่บังคับให้มี exchange/queue ถ้าไม่อยู่)
        try:
            channel.exchange_declare(
                exchange=Config.RABBITMQ_EXCHANGE,
                exchange_type="direct",
                durable=True,
                passive=False,
            )
        except Exception:
            logger.warning("Could not assert exchange; continuing")

        try:
            channel.queue_declare(
                queue=Config.RABBITMQ_QUEUE_RAW, durable=True, passive=False
            )
        except Exception:
            logger.warning("Could not assert raw queue; continuing")

        connection.close()
        result["ok"] = True
        result["detail"] = "connected"
    except Exception as e:
        logger.warning("RabbitMQ health check attempt failed: %s", e)
        result["detail"] = str(e)
    return result


@retry(total_tries=2, initial_delay=0.5, backoff=1.5)
def check_minio() -> dict:
    result = {"ok": False, "detail": None}
    try:
        client = _minio_uploader.client
        # ลอง list buckets เพื่อเช็ก connectivity
        _ = client.list_buckets()
        # ตรวจสอบ bucket ที่คาดหวัง
        for bucket in (Config.MINIO_RAW_BUCKET, Config.MINIO_PROCESSED_BUCKET):
            if not client.bucket_exists(bucket):
                # สร้างถ้าไม่มี (หรือปรับให้ fail ถ้าอยาก strict)
                client.make_bucket(bucket)
                logger.info(f"Created missing bucket: {bucket}")
        result["ok"] = True
        result["detail"] = "connected and buckets present"
    except S3Error as e:
        logger.warning("MinIO S3Error during health check: %s", e)
        result["detail"] = f"S3Error: {e}"
    except Exception as e:
        logger.warning("MinIO health check attempt failed: %s", e)
        result["detail"] = str(e)
    return result


@router.get("/health", tags=["health"])
def health():
    """
    Overall health. 200 only if core dependencies are reachable.
    """
    start = time.time()
    rabbit = check_rabbitmq()
    minio = check_minio()

    overall_ok = rabbit["ok"] and minio["ok"]
    status_code = 200 if overall_ok else 503

    payload = {
        "service": "processing-service",
        "status": "ok" if overall_ok else "degraded",
        "checks": {
            "rabbitmq": rabbit,
            "minio": minio,
        },
        "uptime_seconds": None,
        "timestamp": int(time.time()),
        "duration_ms": round((time.time() - start) * 1000, 2),
    }

    return JSONResponse(status_code=status_code, content=payload)


@router.get("/ready", tags=["health"])
def readiness():
    """
    Readiness: ถ้า dependency ไหนไม่พร้อมจะฟ้อง 503
    """
    rabbit = check_rabbitmq()
    minio = check_minio()

    if not rabbit["ok"]:
        raise HTTPException(status_code=503, detail={"rabbitmq": rabbit["detail"]})
    if not minio["ok"]:
        raise HTTPException(status_code=503, detail={"minio": minio["detail"]})

    return {"ready": True}


@router.get("/", tags=["root"])
def root():
    return {"message": "processing-service is alive"}
