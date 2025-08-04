# app/config.py

from pathlib import Path
from dotenv import load_dotenv
import os
import urllib.parse

def find_dotenv_file() -> Path:
    if os.getenv("DOTENV_PATH"):
        return Path(os.getenv("DOTENV_PATH"))
    p = Path(__file__).resolve()
    for parent in list(p.parents)[:5]:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return Path(".env")

dotenv_path = find_dotenv_file()
load_dotenv(dotenv_path)

class Config:
    # Database
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "thermosense_db")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "thermo")
    @classmethod
    def FULL_DATABASE_URL(cls):
        # Example: postgresql+psycopg2://user:pass@host:port/dbname
        return f"postgresql+psycopg2://{urllib.parse.quote(cls.DB_USER)}:{urllib.parse.quote(cls.DB_PASSWORD)}@{cls.DB_HOST}:{cls.DB_PORT}/{cls.DB_NAME}"

    # Redis
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))

    # MQTT
    MQTT_BROKER_URL = os.getenv("MQTT_BROKER_URL", "mqtt://localhost:1883")
    MQTT_USER = os.getenv("MQTT_USER", "")
    MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

    # MinIO
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_ROOT_USER = os.getenv("MINIO_ROOT_USER", "admin")
    MINIO_ROOT_PASSWORD = os.getenv("MINIO_ROOT_PASSWORD", "admin1234")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() in ("1", "true", "yes")
    MINIO_RAW_BUCKET = os.getenv("MINIO_RAW_BUCKET", "thermo-raw")

    @classmethod
    def get_minio_hostport(cls):
        ep = cls.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
        return ep