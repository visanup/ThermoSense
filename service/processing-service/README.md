# Processing Service

Processing Service เป็น microservice ที่ทำหน้าที่:

1. รับ event `raw.created` จาก RabbitMQ (ซึ่งระบุชื่อภาพดิบใน MinIO)
2. ดึงภาพดิบจาก MinIO bucket `thermo-raw`
3. ทำ preprocessing (เตรียมภาพก่อน OCR) ผ่าน pipeline เช่น grayscale, denoise, threshold, deskew
4. อัปโหลดภาพที่ผ่านการประมวลผลไปยัง MinIO bucket `thermo-processed`
5. ส่ง event `processed.created` กลับเข้าไปยัง RabbitMQ เพื่อให้ downstream ใช้งานต่อ

---

## โครงสร้างหลักของโปรเจกต์

```
processing-service/
├── app/
│   ├── api/
│   │   └── endpoints.py             # health & readiness HTTP endpoints
│   ├── services/
│   │   ├── consumer.py              # RabbitMQ consumer orchestration
│   │   ├── minio_uploader.py        # wrapper สำหรับเชื่อมต่อ MinIO (download/upload)
│   │   ├── processor.py             # image processing pipeline (ก่อน OCR)
│   │   ├── publisher.py             # publish event หลังประมวลผลเสร็จ
│   │   └── processing_model.py      # คลาส ImageProcessor (OpenCV based) สำหรับ preprocessing
│   ├── config.py                   # โหลด .env และจัดการ config (RabbitMQ / MinIO / timeouts)
│   ├── main.py                     # entrypoint: รัน consumer + HTTP health พร้อมกัน
│   └── utils/
│       ├── logger.py              # centralized logger
│       └── retry.py               # retry decorator สำหรับ resilience
├── requirements.txt              # dependency list
├── Dockerfile                   # container build
├── .dockerignore               # ลด context ที่ไม่จำเป็น
└── .env (mounted at runtime)    # environment vars (ไม่ควรคัดลอกเข้า image)
```

---

## คุณสมบัติหลัก

* Resilient RabbitMQ consumer พร้อม retry/backoff
* Modular image preprocessing pipeline (grayscale, denoise, adaptive threshold, deskew)
* MinIO integration สำหรับดึงภาพต้นฉบับและอัปโหลดภาพที่ประมวลผลแล้ว
* Event-based flow: รับ `raw.created` → ส่ง `processed.created`
* HTTP health & readiness endpoint
* Structured logging และ retry decorator เพื่อความทนทาน

---

## ตัวอย่าง message formats

### raw\.created (input)

```json
{
  "id": "<uuid>",
  "raw_object_name": "camera1-session123.jpg"
}
```

### processed.created (output)

```json
{
  "id": "<same uuid>",
  "processed_object": "processed-camera1-session123.jpg",
  "status": "complete"
}
```

---

## Environment Variables (.env)

ตัวอย่างค่าจากโฟลเดอร์ root `.env` ที่ควรถูก mount หรือผ่าน docker-compose `env_file`:

```env
# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_VHOST=/thermo
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin1234
RABBITMQ_EXCHANGE=thermo_exchange
RABBITMQ_QUEUE_RAW=raw_created
RABBITMQ_QUEUE_PROCESSED=processed_created
RAW_ROUTING_KEY=raw.created
PROCESSED_ROUTING_KEY=processed.created

# MinIO
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin1234
MINIO_RAW_BUCKET=thermo-raw
MINIO_PROCESSED_BUCKET=thermo-processed
MINIO_SECURE=false

# Service ports
PROCESSING_SERVICE_PORT=5102

# Logging/Timeouts
LOG_LEVEL=INFO
CONNECTION_TIMEOUT=10
READ_TIMEOUT=30
```

---

## การตั้งค่าเริ่มต้น (Local / Dev)

1. ให้แน่ใจว่า RabbitMQ, MinIO พร้อมใช้งาน (อาจใช้ docker-compose ในตัวอย่างด้านล่าง)
2. วาง `.env` ที่ root แล้วให้ service mount ผ่าน `env_file` หรือ volume เช่น:

   ```yaml
   services:
     processing-service:
       build: ./service/processing-service
       env_file: ../../.env  # ปรับ path ตามที่วางโครงสร้าง
       volumes:
         - ./service/processing-service:/app:delegated
         - ../../.env:/app/.env:ro
       ports:
         - "5102:5102"
       depends_on:
         - rabbitmq
         - minio
   ```
3. สร้างภาพดิบใน MinIO raw bucket (หรือใช้ mock publisher ส่ง `raw.created` message)
4. รัน service: ใน container จะรัน `python app/main.py` ซึ่งจะ start HTTP + consumer

---

## ตัวอย่าง docker-compose (snippet)

```yaml
version: '3.9'
services:
  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_VHOST: /thermo
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin1234
    ports:
      - "5672:5672"
      - "15672:15672"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: admin1234
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  processing-service:
    build:
      context: ./service/processing-service
    env_file:
      - ./.env
    volumes:
      - ./service/processing-service:/app:delegated
      - ./.env:/app/.env:ro
    ports:
      - "5102:5102"
    depends_on:
      - rabbitmq
      - minio

volumes:
  minio_data:
```

---

## การรันและทดสอบ

### ทดสอบ config เบื้องต้น (ใน container หรือ local)

```bash
python - <<'PY'
from app.config import Config
print("RabbitMQ URL:", Config.get_rabbitmq_url())
print("MinIO endpoint:", Config.get_minio_endpoint_hostport())
PY
```

### ส่งข้อความทดสอบ (mock publisher)

```python
import pika, json
from app.config import Config

connection = pika.BlockingConnection(pika.URLParameters(Config.get_rabbitmq_url()))
channel = connection.channel()
channel.exchange_declare(exchange=Config.RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
channel.basic_publish(
    exchange=Config.RABBITMQ_EXCHANGE,
    routing_key=Config.RAW_ROUTING_KEY,
    body=json.dumps({
        'id': 'test-id-123',
        'raw_object_name': 'example.jpg'
    }),
    properties=pika.BasicProperties(content_type='application/json')
)
connection.close()
```

---

## Health & Readiness

* `/health`: ตรวจสอบการเชื่อมต่อ RabbitMQ และ MinIO พร้อมแสดงสถานะโดยรวม
* `/ready`: strict readiness; จะคืน 503 ถ้าตัวใดตัวหนึ่งไม่พร้อม

---

## Logging

* ใช้ centralized logger ที่ config ได้ผ่าน env `LOG_LEVEL` และ `LOG_FORMAT`
* สามารถเลือก output แบบ JSON (ดีสำหรับ centralized aggregation) หรือ plain text

---

## ขยายต่อได้ (Extensions)

* ใส่ OCR engine ต่อจาก pipeline ใน `processor.py`
* เพิ่ม dead-letter queue สำหรับ message ที่ process ไม่ได้เรื่อยๆ
* เพิ่ม metrics endpoint (Prometheus) สำหรับนับ processed / failed / latency
* เพิ่ม authentication บน HTTP health endpoint (ถ้าต้องการใน production)
* ใส่ tracing (เช่น OpenTelemetry) เพื่อเชื่อม flow ระหว่าง service อื่นๆ

---

## Troubleshooting

* ถ้า service อ่าน `.env` ไม่เจอ: ตั้ง `DOTENV_PATH` เป็นเส้นทางภายใน container เช่น `/app/.env`
* ถ้าไม่มีภาพใน MinIO: ตรวจสอบชื่อ bucket / credentials และว่า bucket `thermo-raw` มี object จริง
* RabbitMQ connect fail: ตรวจสอบว่า vhost, user/pass และ exchange/queue ถูกประกาศตรงกัน
* ถ้า event ไม่กระโดดไปต่อ: ดู log ของ publisher/consumer ว่ามี exception หรือ retry เกิดขึ้นหรือไม่

---

## สิ่งที่ควรเพิ่มในอนาคต

1. Integration test แบบ end-to-end (mock MinIO + RabbitMQ)
2. CI pipeline ที่ build image, รัน health check, แล้ว deploy
3. Alerting เมื่อ health check ล้มเหลว (เชื่อมกับ system เช่น Prometheus Alertmanager หรือ webhook)
4. Configuration validation startup (fail fast ถ้า env ขาดไป)
