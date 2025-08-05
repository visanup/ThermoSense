# app/services/consumer.py

import os
import uuid
import json
import tempfile
import pika
from app.config import Config
from app.services.processor import OCRLLMProcessor
from app.services.minio_uploader import MinioUploader
from app.database import SessionLocal
from app.models.device import Device
from app.models.temperature_readings import TemperatureReading
from app.models.image_object import ImageObject, ObjectStatus
from app.utils.logger import get_logger

logger = get_logger("ocr-consumer")

class OCRConsumer:
    """
    RabbitMQ consumer that listens on processed.created, downloads processed images,
    sends them to a multimodal LLM for temperature extraction, and writes results to DB.
    """
    def __init__(self):
        params = pika.URLParameters(Config.get_rabbitmq_url())
        self.conn = pika.BlockingConnection(params)
        self.channel = self.conn.channel()

        self.channel.exchange_declare(
            exchange=Config.RABBITMQ_EXCHANGE,
            exchange_type="direct",
            durable=True
        )
        self.channel.queue_declare(
            queue=Config.RABBITMQ_QUEUE_PROCESSED,
            durable=True
        )
        self.channel.queue_bind(
            queue=Config.RABBITMQ_QUEUE_PROCESSED,
            exchange=Config.RABBITMQ_EXCHANGE,
            routing_key=Config.PROCESSED_ROUTING_KEY
        )
        self.channel.basic_qos(prefetch_count=1)

        self.minio = MinioUploader()
        self.processor = OCRLLMProcessor()
        self.db = SessionLocal()

    def callback(self, ch, method, properties, body):
        image_id = None
        try:
            msg = json.loads(body)
            
            # ดึงชื่อไฟล์เต็ม
            object_name = msg.get("processed_object_name") or msg.get("processed_object") or msg.get("objectKey")
            if not object_name:
                logger.error(f"Message missing processed object name: {msg}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # กำหนด bucket ตาม logic ของคุณ หรือส่งมาจาก message ก็ได้
            bucket = msg.get("bucket") or "thermo-processed"

            # หา ImageObject จาก DB ตาม bucket และ object_name
            img_obj = self.db.query(ImageObject).filter(
                ImageObject.object_name == object_name,
                ImageObject.minio_bucket == bucket
            ).first()

            if not img_obj:
                logger.error(f"Image object not found for bucket={bucket} and object_name={object_name}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            image_id = img_obj.id

            # ดึง device_id จาก prefix ชื่อโฟลเดอร์ เช่น processed-2/xxx.jpg
            try:
                device_id_str = object_name.split("/")[0].replace("processed-", "")
                device_id = int(device_id_str)
            except Exception:
                # fallback กรณีแปลงไม่สำเร็จ
                device_id = img_obj.device_id

            # ใช้ recorded_at จากฐานข้อมูล image object เพื่อความถูกต้อง
            recorded_at = img_obj.recorded_at
            raw_id = msg.get("raw_image_id")

            # ดาวน์โหลดไฟล์จาก MinIO
            data = self.minio.download_processed(object_name)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(object_name)[1])
            tmp.write(data)
            tmp.close()
            logger.info(f"Downloaded image {object_name} for OCR")

            # ประมวลผลภาพเพื่อดึงอุณหภูมิ
            temperature = self.processor.process(tmp.name)
            logger.info(f"Extracted temperature: {temperature}°C for image_id={image_id}")

            # ตรวจสอบว่ามี TemperatureReading แถวนี้อยู่แล้วหรือไม่ (device_id + recorded_at)
            existing_reading = self.db.query(TemperatureReading).filter(
                TemperatureReading.device_id == device_id,
                TemperatureReading.recorded_at == recorded_at
            ).first()

            if existing_reading:
                # อัปเดตข้อมูลแทนเพิ่มใหม่
                existing_reading.temperature = temperature
                existing_reading.raw_image_id = raw_id
                existing_reading.processed_image_id = image_id
                logger.info(f"Updated existing temperature reading for device_id={device_id} at {recorded_at}")
            else:
                reading = TemperatureReading(
                    device_id=device_id,
                    recorded_at=recorded_at,
                    temperature=temperature,
                    raw_image_id=raw_id,
                    processed_image_id=image_id
                )
                self.db.add(reading)
                logger.info(f"Inserted new temperature reading for device_id={device_id} at {recorded_at}")

            # อัปเดตสถานะภาพในตาราง image_objects
            img_obj.status = ObjectStatus.completed
            self.db.commit()

            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"Successfully processed image_id={image_id}")

        except Exception as e:
            logger.exception(f"Failed OCR processing for image_id={image_id}")
            try:
                self.db.rollback()
            except Exception:
                pass
            if image_id:
                img = self.db.get(ImageObject, image_id)
                if img:
                    img.status = ObjectStatus.failed
                    self.db.commit()
            ch.basic_ack(delivery_tag=method.delivery_tag)


    def start(self):
        logger.info("Starting OCR consumer on processed.created...")
        self.channel.basic_consume(
            queue=Config.RABBITMQ_QUEUE_PROCESSED,
            on_message_callback=self.callback
        )
        try:
            self.channel.start_consuming()
        finally:
            self.close()

    def close(self):
        try:
            if self.conn and not self.conn.is_closed:
                self.conn.close()
        finally:
            self.db.close()
