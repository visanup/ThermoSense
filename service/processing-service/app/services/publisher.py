# service/processing-service/app/services/publisher.py

import json
import pika
from pika.exceptions import AMQPConnectionError, ChannelClosedByBroker
from app.config import Config
from app.utils.logger import get_logger
from app.utils.retry import retry

logger = get_logger("publisher")


class Publisher:
    def __init__(self):
        self.logger = logger
        self.url = Config.get_rabbitmq_url()
        self.exchange = Config.RABBITMQ_EXCHANGE
        self.processed_key = Config.PROCESSED_ROUTING_KEY

    @retry(total_tries=4, initial_delay=1.0, backoff=2.0)
    def publish_processed_event(self, image_id: str, processed_object_name: str):
        self.logger.info(f"Publishing processed.created for image_id={image_id}")
        connection = None
        try:
            params = pika.URLParameters(self.url)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.exchange_declare(
                exchange=self.exchange, exchange_type="direct", durable=True
            )
            payload = {
                "id": image_id,
                "processed_object": processed_object_name,
                "status": "complete",
            }
            channel.basic_publish(
                exchange=self.exchange,
                routing_key=self.processed_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(
                    content_type="application/json", delivery_mode=2
                ),
            )
            self.logger.info(f"Published processed.created for {image_id}")
        except (AMQPConnectionError, ChannelClosedByBroker) as e:
            self.logger.warning(f"Transient error publishing event for {image_id}: {e}")
            raise  # trigger retry
        except Exception as e:
            self.logger.exception(f"Failed to publish processed event for {image_id}: {e}")
            raise
        finally:
            if connection:
                try:
                    connection.close()
                except Exception:
                    self.logger.warning("Error closing RabbitMQ connection after publish", exc_info=True)
