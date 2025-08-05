# service/processing-service/app/services/consumer.py

import json
import uuid
from typing import Callable, Optional

import pika
from pika.exceptions import AMQPConnectionError

from app.config import Config
from app.utils.logger import get_logger
from app.utils.retry import retry
from app.services.minio_uploader import MinioUploader
from app.services.processor import Processor
from app.services.publisher import Publisher

logger = get_logger("consumer")


class RabbitMQConsumer:
    def __init__(self, on_error: Optional[Callable[[Exception], None]] = None, roi: tuple[int, int, int, int] = (0, 0, 0, 0)):
        self.url = Config.get_rabbitmq_url()
        self.exchange = Config.RABBITMQ_EXCHANGE
        self.raw_queue = Config.RABBITMQ_QUEUE_RAW
        self.raw_routing_key = Config.RAW_ROUTING_KEY
        self.processed_routing_key = Config.PROCESSED_ROUTING_KEY
        self.on_error = on_error

        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.adapters.blocking_connection.BlockingChannel] = None

        self.uploader = MinioUploader()
        self.roi = roi
        self.processor = Processor(self.roi)
        self.publisher = Publisher()

    @retry(total_tries=5, initial_delay=1.0, backoff=2.0)
    def _connect(self):
        logger.info("Attempting to connect to RabbitMQ")
        params = pika.URLParameters(self.url)
        self.connection = pika.BlockingConnection(params)
        self.channel = self.connection.channel()
        self.channel.exchange_declare(
            exchange=self.exchange, exchange_type="direct", durable=True
        )
        self.channel.queue_declare(queue=self.raw_queue, durable=True)
        self.channel.queue_bind(
            queue=self.raw_queue, exchange=self.exchange, routing_key=self.raw_routing_key
        )
        self.channel.basic_qos(prefetch_count=1)
        logger.info("Connected to RabbitMQ and queue declared/bound")

    def _handle_message(self, ch, method, properties, body):
        delivery_tag = method.delivery_tag
        image_id = None
        try:
            msg = json.loads(body)
            image_id = msg.get("id") or str(uuid.uuid4())
            # support both keys
            raw_object_name = msg.get("raw_object_name") or msg.get("objectKey")
            if not raw_object_name:
                raise ValueError("raw_object_name missing in message")
            logger.info(f"Received raw.created: id={image_id} object={raw_object_name}")

            # Download raw image
            raw_bytes = self.uploader.download_raw(raw_object_name)

            # Process image
            processed_bytes = self.processor.process(raw_bytes)

            # Prepare processed object name
            processed_name = f"processed-{raw_object_name}"

            # Upload processed image
            self.uploader.upload_processed(processed_name, processed_bytes)

            # Publish event downstream
            self.publisher.publish_processed_event(
                image_id=image_id,
                processed_object_name=processed_name
            )

            ch.basic_ack(delivery_tag=delivery_tag)
            logger.info(f"Finished processing {image_id}")
        except Exception as e:
            logger.exception(f"Error processing message id={image_id}")
            if self.on_error:
                try:
                    self.on_error(e)
                except Exception:
                    logger.warning("on_error callback raised exception")
            # NACK without requeue to avoid infinite loop unless you want DLQ
            try:
                ch.basic_nack(delivery_tag=delivery_tag, requeue=False)
            except Exception:
                logger.warning("Failed to nack message", exc_info=True)

    def start_consuming(self):
        try:
            self._connect()
        except Exception as e:
            logger.error(
                "Failed to establish connection to RabbitMQ after retries, exiting consumer"
            )
            if self.on_error:
                self.on_error(e)
            return

        if not self.channel:
            logger.error("No channel available after connection; aborting consumption")
            return

        self.channel.basic_consume(
            queue=self.raw_queue, on_message_callback=self._handle_message
        )
        logger.info("Start consuming raw queue")
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Consumer interrupted, shutting down")
        except Exception:
            logger.exception("Unexpected error in consuming loop")
        finally:
            if self.connection and not self.connection.is_closed:
                try:
                    self.connection.close()
                except Exception:
                    logger.warning("Error closing RabbitMQ connection", exc_info=True)
