# app/api/endpoints.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import time

from app.config import Config
from app.database import engine
from sqlalchemy import text
import redis
from minio import Minio
from minio.error import S3Error

router = APIRouter()

logger = logging.getLogger("endpoints")


class HealthResponse(BaseModel):
    status: str
    checks: dict


def check_postgres() -> dict:
    try:
        with engine.connect() as conn:
            # lightweight query
            result = conn.execute(text("SELECT 1"))
            _ = result.scalar()
        return {"postgres": {"ok": True}}
    except Exception as e:
        logger.exception("Postgres health check failed")
        return {"postgres": {"ok": False, "error": str(e)}}


def check_redis() -> dict:
    try:
        r = redis.Redis(host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=Config.REDIS_DB, socket_connect_timeout=2)
        pong = r.ping()
        return {"redis": {"ok": bool(pong)}}
    except Exception as e:
        logger.exception("Redis health check failed")
        return {"redis": {"ok": False, "error": str(e)}}


def check_minio() -> dict:
    try:
        endpoint = Config.get_minio_hostport()
        client = Minio(
            endpoint,
            access_key=Config.MINIO_ROOT_USER,
            secret_key=Config.MINIO_ROOT_PASSWORD,
            secure=Config.MINIO_SECURE,
        )
        bucket = Config.MINIO_RAW_BUCKET
        exists = client.bucket_exists(bucket)
        return {"minio": {"ok": exists, "bucket": bucket}}
    except Exception as e:
        logger.exception("MinIO health check failed")
        return {"minio": {"ok": False, "error": str(e)}}


@router.get("/health", response_model=HealthResponse)
def health():
    """
    General health endpoint. Checks connectivity to Postgres, Redis, MinIO.
    """
    checks = {}
    checks.update(check_postgres())
    checks.update(check_redis())
    checks.update(check_minio())

    overall = "ok" if all(v.get("ok") for v in (checks.get("postgres"), checks.get("redis"), checks.get("minio"))) else "degraded"
    return HealthResponse(status=overall, checks=checks)


@router.get("/ready")
def readiness():
    """
    Readiness: Are dependencies reachable?
    """
    checks = {}
    checks.update(check_postgres())
    checks.update(check_redis())
    # MinIO might be optional for readiness depending on your strictness
    minio_check = check_minio()
    checks.update(minio_check)

    if all(v.get("ok") for v in checks.values()):
        return {"ready": True, "checks": checks}
    else:
        raise HTTPException(status_code=503, detail={"ready": False, "checks": checks})


@router.get("/live")
def liveness():
    """
    Liveness: Is service process alive (always true unless internal failure)
    """
    return {"alive": True, "timestamp": int(time.time())}

