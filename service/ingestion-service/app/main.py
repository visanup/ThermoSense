# app/main.py
import logging
import signal
import sys
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
import uvicorn

from app.api.endpoints import router
from app.services.mqtt_consumer import MQTTConsumer

# --- logging setup ---
logging.basicConfig(
    level=logging.DEBUG,  # ชั่วคราวให้เห็นละเอียด พอมั่นใจแล้วเปลี่ยนเป็น INFO ได้
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("ingestion_main")
shutdown_flag = threading.Event()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lifespan startup: instantiating MQTTConsumer")
    consumer = MQTTConsumer()
    thread = threading.Thread(target=consumer.start, daemon=True)
    app.state.consumer = consumer
    app.state.consumer_thread = thread
    thread.start()
    yield
    logger.info("Lifespan shutdown: stopping MQTTConsumer")
    try:
        consumer.stop()
    except Exception as e:
        logger.warning("Error stopping consumer: %s", e)
    app.state.consumer_thread.join(timeout=5)
    if app.state.consumer_thread.is_alive():
        logger.warning("Consumer thread did not exit cleanly")


def create_app() -> FastAPI:
    app = FastAPI(title="Ingestion Service", lifespan=lifespan)
    app.include_router(router)
    return app


def handle_signal(signum, frame):
    logger.info("Received signal %s, initiating shutdown", signum)
    shutdown_flag.set()


def main():
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    app = create_app()
    config = uvicorn.Config(app, host="0.0.0.0", port=5101, log_level="info", lifespan="on")
    server = uvicorn.Server(config)

    try:
        logger.info("Starting ingestion service HTTP + MQTT consumer")
        server.run()
    except Exception as e:
        logger.exception("Server exception: %s", e)
    finally:
        logger.info("Ingestion service exiting")
        sys.exit(0)


if __name__ == "__main__":
    main()
