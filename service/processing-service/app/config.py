## config.py

from pathlib import Path
from dotenv import load_dotenv
import os
import urllib.parse

# --- load .env แบบยืดหยุ่น ---
def find_dotenv_file() -> Path:
    if os.getenv("DOTENV_PATH"):
        return Path(os.getenv("DOTENV_PATH"))
    p = Path(__file__).resolve()
    for parent in list(p.parents)[:5]:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return Path(".env")  # fallback

dotenv_path = find_dotenv_file()
load_dotenv(dotenv_path)

# --- Core config container ---
class Config:
    # --- RabbitMQ ---
    RABBITMQ_HOST: str = os.getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_VHOST: str = os.getenv("RABBITMQ_VHOST", "/")
    RABBITMQ_USER: str = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASSWORD: str = os.getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_EXCHANGE: str = os.getenv("RABBITMQ_EXCHANGE", "thermo_exchange")
    RABBITMQ_QUEUE_RAW: str = os.getenv("RABBITMQ_QUEUE_RAW", "raw_created")
    RABBITMQ_QUEUE_PROCESSED: str = os.getenv("RABBITMQ_QUEUE_PROCESSED", "processed_created")
    RAW_ROUTING_KEY: str = os.getenv("RAW_ROUTING_KEY", "raw.created")
    PROCESSED_ROUTING_KEY: str = os.getenv("PROCESSED_ROUTING_KEY", "processed.created")

    # --- MinIO ---
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ROOT_USER: str = os.getenv("MINIO_ROOT_USER", "minioadmin")
    MINIO_ROOT_PASSWORD: str = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() in ("1", "true", "yes")
    MINIO_RAW_BUCKET: str = os.getenv("MINIO_RAW_BUCKET", "thermo-raw")
    MINIO_PROCESSED_BUCKET: str = os.getenv("MINIO_PROCESSED_BUCKET", "thermo-processed")

    # --- Optional / general ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    CONNECTION_TIMEOUT: int = int(os.getenv("CONNECTION_TIMEOUT", "10"))
    READ_TIMEOUT: int = int(os.getenv("READ_TIMEOUT", "30"))

    @classmethod
    def get_rabbitmq_url(cls) -> str:
        # vhost in URI must be URL-encoded; leading slash becomes %2f if present
        vhost = cls.RABBITMQ_VHOST
        if vhost == "/":
            vhost_enc = "%2f"
        else:
            # strip leading slash for encode then re-add if needed
            vhost_enc = urllib.parse.quote(vhost, safe="")
        return f"amqp://{urllib.parse.quote(cls.RABBITMQ_USER)}:{urllib.parse.quote(cls.RABBITMQ_PASSWORD)}@{cls.RABBITMQ_HOST}:{cls.RABBITMQ_PORT}/{vhost_enc}"

    @classmethod
    def get_minio_endpoint_hostport(cls) -> str:
        # strip schema if user passed http:// or https://
        ep = cls.MINIO_ENDPOINT
        ep = ep.replace("http://", "").replace("https://", "")
        return ep
