# app/utils/retry.py
import time
import random
import functools
from typing import Callable, Tuple, Type

from app.utils.logger import get_logger

class RetryException(Exception):
    pass

def retry(
    exceptions: Tuple[Type[BaseException], ...] = (Exception,),
    total_tries: int = 3,
    initial_delay: float = 1.0,
    backoff: float = 2.0,
    max_delay: float = 30.0,
    jitter: float = 0.1,
):
    """
    Decorator to retry a function with exponential backoff and optional jitter.

    Example:
        @retry(total_tries=5, initial_delay=0.5)
        def unstable():
            ...
    """
    def decorator(fn: Callable):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            logger = get_logger(fn.__module__)
            delay = initial_delay
            for attempt in range(1, total_tries + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    if attempt == total_tries:
                        logger.error(f"Function {fn.__name__} failed after {attempt} attempts: {e}")
                        raise
                    jittered = delay * (1 + random.uniform(-jitter, jitter))
                    logger.warning(
                        f"Attempt {attempt} failed for {fn.__name__}: {e}. Retrying in {jittered:.2f}s..."
                    )
                    time.sleep(min(jittered, max_delay))
                    delay = min(delay * backoff, max_delay)
            raise RetryException(f"Retries exhausted for {fn.__name__}")
        return wrapper
    return decorator
