# app/services/redis_client.py
import os
import threading
import redis
from typing import Optional

# Lazy singleton for Redis connection to avoid reconnect churn
class RedisClient:
    _client: Optional[redis.Redis] = None
    _lock = threading.Lock()

    @classmethod
    def get_client(cls) -> redis.Redis:
        """
        Return a shared Redis client instance. Uses environment variables:
          REDIS_HOST, REDIS_PORT, REDIS_DB
        """
        if cls._client is None:
            with cls._lock:
                if cls._client is None:
                    host = os.getenv("REDIS_HOST", "localhost")
                    port = int(os.getenv("REDIS_PORT", "6379"))
                    db = int(os.getenv("REDIS_DB", "0"))
                    cls._client = redis.Redis(
                        host=host,
                        port=port,
                        db=db,
                        decode_responses=False,  # keep raw bytes; caller can decode if needed
                    )
        return cls._client

    @classmethod
    def acquire_lock(cls, name: str, ttl: int = 30) -> bool:
        """
        Simple lock using SET NX with expiration.
        Returns True if lock acquired, False otherwise.
        """
        client = cls.get_client()
        try:
            # NX ensures only set if not exists; ex sets TTL
            acquired = client.set(name, "1", nx=True, ex=ttl)
            return bool(acquired)
        except Exception:
            return False

    @classmethod
    def release_lock(cls, name: str) -> None:
        """
        Release lock by deleting the key.
        """
        client = cls.get_client()
        try:
            client.delete(name)
        except Exception:
            pass
