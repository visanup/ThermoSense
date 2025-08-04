# Ingestion Service

## Overview

`ingestion-service` รับภาพที่ส่งมาเป็น chunk ผ่าน MQTT, ประกอบภาพ, อัปโหลดไปที่ MinIO (bucket: `thermo-raw`), และบันทึก metadata ลง PostgreSQL. ระบบออกแบบให้: dedupe per-capture (session UUID), เก็บ chunk ชั่วคราวใน Redis, ใช้ lock เพื่อป้องกัน race condition และมี fallback สำหรับกล้องที่ส่งแค่ camera ID โดยไม่ต้องเปลี่ยน firmware.

### High-level flow

1. MQTTConsumer เชื่อมต่อกับ MQTT broker แล้ว subscribe `camera/+/image_json`.
2. รับข้อความ JSON ที่มี fields อย่างน้อย: `id` (camera id), `index`, `total`, `data` (base64 chunk).
3. สร้างหรือ reuse session UUID สำหรับ capture ปัจจุบัน (จาก `camera_uid`) ถ้า payload ไม่มี `image_id`.
4. เก็บ chunk และ metadata ลง Redis ผ่าน `ChunkAssembler`.
5. เมื่อครบทุก chunk: ประกอบเป็นภาพ, คำนวณ checksum, อัปโหลดไป MinIO, สร้าง/อัปเดต `image_objects` ใน DB.
6. ทำ mark\_processed และล้าง session mapping เพื่อให้ capture ถัดไปได้ image\_id ใหม่.

## Prerequisites

* Python 3.11+
* Running services (usually via Docker Compose):

  * MQTT broker (เช่น Mosquitto) ที่กล้องส่งภาพ
  * Redis (เก็บ chunk + session + locks)
  * MinIO (object storage)
  * PostgreSQL (schema ต้องเตรียมไว้ตาม provided SQL)

## Environment

Load `.env` (ตัวอย่างอยู่ที่โค้ดหลัก) มีค่าที่สำคัญ:

```env
MQTT_BROKER_URL=mqtt://<broker-host>:1883
MQTT_USER=admin
MQTT_PASSWORD=admin1234
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin1234
MINIO_RAW_BUCKET=thermo-raw
DATABASE_URL=postgresql://postgres:password@postgres:5432/thermosense_db
```

## Setup (development / containerized)

1. Build the service image:

   ```bash
   ```

docker compose build ingestion\_service

````
2. Start required dependencies and the ingestion service:
   ```bash
docker compose up ingestion_service
````

3. Healthcheck endpoint is available at `http://localhost:5101/health`.

## Key Files & Components

* `app/main.py`: FastAPI entrypoint with lifespan startup logic to launch `MQTTConsumer`.
* `app/services/mqtt_consumer.py`: Connects to MQTT and forwards chunk messages.
* `app/services/ingestion_service.py`: Core orchestration (session handling, assembly, upload, DB persistence).
* `app/services/chunk_assembler.py`: Manages chunk storage, assembly, and dedupe flags in Redis.
* `app/services/redis_client.py`: Singleton Redis client and simple locking.
* `app/services/minio_uploader.py`: Uploads assembled images to MinIO.
* `app/models/*`: SQLAlchemy models for devices and image\_objects.

## Running a Smoke Test

มีสคริปต์ตัวอย่าง (เช่น `publish_test_image.py`) ที่ส่งภาพแบบ chunk เข้า MQTT:

1. รัน publisher เพื่อส่งภาพ:

   ```bash
   ```

python publish\_test\_image.py

````
2. ตรวจ log ของ ingestion service:
   ```bash
docker compose logs -f ingestion_service
````

3. ยืนยันว่า:

   * ภาพถูกประกอบ (complete chunk count)
   * อัปโหลดไป MinIO
   * บันทึก record ใน PostgreSQL

## Session Handling & Reset

* แต่ละ capture จากกล้องจะได้ `image_id` แบบ UUID (session) ที่เกิดจาก fallback เมื่อ payload มีแค่ camera id.
* ถ้าต้องการรีเซ็ต capture เก่า (เช่นให้ประมวลผลซ้ำ) ให้ลบ key ใน Redis:

  ```bash
  ```

# ลบ flag processed และ chunk storage

redis-cli DEL processed:\<image\_id>
redis-cli KEYS "image\_chunks:\<image\_id>\*" | xargs redis-cli DEL

# ถ้าใช้ camera-session mapping ก็ลบด้วย

redis-cli DEL camera\_session:\<camera\_uid>

````

## Logging / Observability
- Log ระดับ DEBUG/INFO จะแสดงขั้นตอนสำคัญ: session creation, chunk stored, assembly, upload, DB persistence.
- ตัวอย่าง log ที่ควรเห็นเมื่อ capture สำเร็จ:
  - Saved image object ... for camera ... (image_id=...)

## Error Handling & Retry
- Upload to MinIO มี retry แบบ exponential backoff
- ถ้า upload หรือ DB insert ล้มเหลว จะไม่ mark ว่า processed ทำให้สามารถ retry ใหม่ได้
- Locking ใช้ Redis SET NX เพื่อป้องกัน concurrent assemble

## Extending / Next Steps
- เพิ่ม endpoint ตรวจสถานะของ `image_id` (เช็ค chunk progress / DB record)
- ทำ cleanup background job สำหรับ stale partials (ปัจจุบันสามารถเรียก `cleanup_stale` ด้วยตนเอง)
- เพิ่ม metrics (latency, success/failure counts)

## Troubleshooting
- ถ้าไม่เห็น chunk ถูกประมวลผล: ตรวจว่า MQTTConsumer เชื่อม broker สำเร็จ และ topic ถูกต้อง (`camera/{id}/image_json`).
- ถ้าภาพถูกข้าม: ตรวจสอบว่า `already_processed` flag ยังคงอยู่ใน Redis และรีเซ็ตถ้าต้องการ reprocess.
- เช็คการเชื่อมต่อ MinIO / Redis / PostgreSQL จาก container ด้วย shell (เช่น ping, redis-cli, psql)

## Example Payload (from camera)
```json
{
  "id": "1",              # camera uid
  "index": 0,              # chunk index (0-based)
  "total": 15,             # total chunks for this image
  "data": "<base64 chunk>"
}
````

## License / Attribution

(ถ้ามีข้อกำหนดภายใน ใส่ที่นี่)
