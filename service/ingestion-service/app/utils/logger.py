# app/utils/logger.py
import logging
import os
import sys
from typing import Optional

# optional structured logging if python-json-logger is installed
try:
    from pythonjsonlogger import jsonlogger  # type: ignore
    _HAS_JSONLOGGER = True
except ImportError:
    _HAS_JSONLOGGER = False

DEFAULT_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", "json").lower()  # use "plain" for human readable

def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured

    log_level = (level or DEFAULT_LEVEL).upper()
    logger.setLevel(getattr(logging, log_level, logging.INFO))

    handler = logging.StreamHandler(sys.stdout)

    if LOG_FORMAT in ("json", "structured") and _HAS_JSONLOGGER:
        fmt = jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    else:
        fmt = logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s")

    handler.setFormatter(fmt)
    logger.addHandler(handler)
    logger.propagate = False
    return logger

