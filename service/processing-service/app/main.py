# app/main.py

import threading
import signal
import time
from typing import Optional

from fastapi import FastAPI
import uvicorn

from app.utils.logger import get_logger
from app.utils.retry import retry
from app.config import Config
from app.api.endpoints import router  # FastAPI health endpoints
from app.services.consumer import RabbitMQConsumer

logger = get_logger("main")
shutdown_flag = threading.Event()


def run_http():
    app = FastAPI(title="Processing Service")
    app.include_router(router)
    port = int(Config.__dict__.get("PROCESSING_SERVICE_PORT", 5102))
    logger.info("Starting HTTP server (health) on 0.0.0.0:%s", port)
    # Uvicorn run is blocking, so this lives in its own thread
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


@retry(total_tries=5, initial_delay=1.0, backoff=2.0)
def start_consumer_with_retry():
    consumer = RabbitMQConsumer(on_error=lambda e: logger.error("Consumer error callback: %s", e))
    consumer.start_consuming()


def run_consumer_loop():
    while not shutdown_flag.is_set():
        try:
            start_consumer_with_retry()
            # If start_consumer returns (e.g., stopped), break unless we want to restart
            logger.warning("Consumer exited normally or unrecoverably; breaking loop")
            break
        except Exception as e:
            logger.error("Consumer failed to start or crashed: %s", e)
            # Exponential backoff is handled by @retry; if exhausted, wait a bit before giving up entirely
            if shutdown_flag.is_set():
                break
            logger.info("Waiting 5s before next consumer restart attempt")
            time.sleep(5)


def handle_signal(signum, frame):
    logger.info("Received signal %s, initiating shutdown", signum)
    shutdown_flag.set()


def main():
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    http_thread = threading.Thread(target=run_http, daemon=True)
    consumer_thread = threading.Thread(target=run_consumer_loop, daemon=True)

    http_thread.start()
    consumer_thread.start()

    # Wait for shutdown
    try:
        while not shutdown_flag.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received, shutting down")
        shutdown_flag.set()

    logger.info("Shutdown flag set, waiting for threads to finish")
    # give threads a moment to cleanup
    time.sleep(1)
    logger.info("Processing service exiting")


if __name__ == "__main__":
    main()
