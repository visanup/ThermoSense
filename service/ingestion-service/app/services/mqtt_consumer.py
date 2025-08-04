# app/services/mqtt_consumer.py
import json
import logging
import time
from urllib.parse import urlparse

from paho.mqtt import client as mqtt_client

from app.config import Config
from app.services.ingestion_service import IngestionService

logger = logging.getLogger("mqtt_consumer")


class MQTTConsumer:
    def __init__(self):
        self.ingestion = IngestionService()
        self.client = mqtt_client.Client()
        if Config.MQTT_USER:
            self.client.username_pw_set(Config.MQTT_USER, Config.MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

        parsed = urlparse(Config.MQTT_BROKER_URL)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 1883
        self.topic = "camera/+/image_json"

        # connect with simple retry/backoff loop but do not raise to kill process
        backoff = 1
        while True:
            try:
                logger.info("Trying MQTT connect to %s:%s", self.host, self.port)
                self.client.connect(self.host, self.port)
                logger.info("Connected to MQTT broker at %s:%s", self.host, self.port)
                break
            except Exception as e:
                logger.warning("MQTT connect failed: %s; retrying in %s seconds", e, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("MQTT connected, subscribing to %s", self.topic)
            client.subscribe(self.topic)
        else:
            logger.error("MQTT connection error, rc=%s", rc)

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except Exception as e:
            logger.error("Invalid JSON on topic %s: %s", msg.topic, e)
            return

        logger.info("Received chunk: id=%s index=%s total=%s", payload.get("id"), payload.get("index"), payload.get("total"))
        try:
            self.ingestion.process_chunk_message(payload, msg.topic)
        except Exception:
            logger.exception("Failed to process chunk message")

    def start(self):
        self.client.loop_start()
        # keep the thread alive
        while True:
            time.sleep(1)

    def stop(self):
        try:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT consumer stopped")
        except Exception as e:
            logger.warning("Error stopping MQTT consumer: %s", e)
