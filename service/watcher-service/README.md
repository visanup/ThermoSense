แน่นอน นี่ `README.md` ที่ละเอียดสำหรับ **watcher-service** — ครอบคลุมตั้งแต่ภาพรวม สถาปัตยกรรม การตั้งค่า สตาร์ท พัฒนา ดีบัก และ edge cases:

````md
# watcher-service

`watcher-service` เป็น service ที่เฝ้าดูไฟล์ใหม่ใน **MinIO** สอง bucket (`thermo-raw` กับ `thermo-processed`), ทำการ upsert ข้อมูลลงในฐานข้อมูล, แล้วส่ง event ไปยัง **RabbitMQ** พร้อม context (เช่น ไฟล์, device, status) รวมถึงมีเมคานิซึม reconciliation เพื่อจัดการกรณีที่งาน “ติด” (stuck)

---

## 🔧 ภาพรวมสถาปัตยกรรม

1. **MinIO** — แหล่งเก็บรูปภาพแบบ S3-compatible  
   - `thermo-raw`: ภาพดิบที่เพิ่งเข้ามา → status `'pending'`  
   - `thermo-processed`: ภาพผ่านกระบวนการแล้ว → status `'processing'` (หรือ `'completed'` ตาม workflow)

2. **PostgreSQL (schema `thermo`)**  
   - เก็บ `devices` และ `image_objects`  
   - ความสัมพันธ์: `image_objects.device_id` อ้างอิง `devices.id`

3. **watcher-service**  
   - ฟัง notification จาก MinIO (object created)  
   - หา/สร้าง `Device` จากชื่อไฟล์ (หรือ metadata)  
   - Upsert `ImageObject` พร้อมสถานะ (raw → `pending`, processed → `processing`)  
   - ส่ง event ไป RabbitMQ (routing key `raw.created` / `processed.created`)  
   - มี reconciliation loop ตรวจสอบ `image_objects` ที่ค้างเกินเวลาที่กำหนด แล้วรี-publish event หรือ mark failed

4. **RabbitMQ**  
   - รับ event เพื่อให้ downstream services (เช่น ingestion / processing) ทำงานต่อ

---

## ⚙️ ความต้องการก่อนรัน

- Node.js (เวอร์ชันที่ project กำหนด, มักใช้ใน Docker image)
- PostgreSQL (schema `thermo` สร้างตาม migration / SQL script)
- MinIO (ตั้ง buckets `thermo-raw`, `thermo-processed`)
- RabbitMQ
- `.env` หรือ environment variables ที่ถูกต้อง

---

## 📦 ตัวอย่างไฟล์ `.env`

```env
# Database (Postgres)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=thermosense_db
DB_USER=postgres
DB_PASSWORD=password
DB_SCHEMA=thermo

# Service port
WATCHER_SERVICE_PORT=5105

# MinIO
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin1234
MINIO_RAW_BUCKET=thermo-raw
MINIO_PROCESSED_BUCKET=thermo-processed

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin1234
RABBITMQ_VHOST=/thermo
RABBITMQ_EXCHANGE=thermo_exchange
RAW_ROUTING_KEY=raw.created
PROCESSED_ROUTING_KEY=processed.created

# Node env
NODE_ENV=development
````

> หมายเหตุ: `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` จะ fallback จาก `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` โดยอัตโนมัติ

---

## 🛠 การติดตั้ง & build

```sh
# ติดตั้ง dependencies
yarn install

# สร้าง build (TypeScript -> JavaScript)
yarn build
```

---

## ▶️ การรัน (ไม่ผ่าน Docker)

```sh
# ต้องมี .env ใน path ที่โค้ดโหลด (default คือ project root)
yarn start   # หรือวิธีที่กำหนดใน package.json ที่เรียก node dist/server.js
```

---

## 🐳 รันด้วย Docker Compose (ตัวอย่าง snippet)

```yaml
watcher_service:
  build:
    context: ./service/watcher-service
    dockerfile: Dockerfile
  ports:
    - "${WATCHER_SERVICE_PORT}:5105" # host:container
  env_file:
    - .env
  depends_on:
    - postgres
    - minio
    - rabbitmq
  environment:
    # ถ้าอยาก override
    # WATCHER_SERVICE_PORT: 5105
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:5105/health || exit 1"]
    interval: 15s
    timeout: 5s
    retries: 3
    start_period: 5s
```

จากนั้น:

```sh
docker-compose up -d --build watcher_service
```

---

## 📡 API

### `GET /health`

Health check endpoint

**Response:**

```json
{
  "status": "ok",
  "ts": "2025-08-02T11:07:35.123Z"
}
```

---

## 📥 Event Flow (เมื่อมีไฟล์ใหม่)

1. MinIO ส่ง notification (object created)
2. watcher-service:

   * ดึง `objectKey`
   * แปลงหา `device_uid` จากชื่อไฟล์ (function: `parseDeviceUIDFromObjectKey`)
   * หา/สร้าง `Device` (`getOrCreateDeviceByUID`)
   * Upsert `ImageObject` (status ตาม bucket)
   * สร้าง `WatcherEvent` พร้อม context (รวม `imageObjectId`, `deviceId`, `status`)
   * Publish ไปยัง RabbitMQ (exchange + routing key ที่เหมาะสม)

---

## 🧠 Reconciliation

เพื่อจัดการกรณีที่:

* Event หาย
* Task ค้างที่ status เดิมเกิน threshold

ระบบจะ:

1. รันทุกๆ `RECONCILE_INTERVAL_MS` (default 60000ms)
2. หา `image_objects` ที่ติดอยู่ใน `pending` หรือ `processing` เกิน threshold
3. ตรวจสอบว่าฟายล์ยังอยู่ใน MinIO:

   * ถ้าอยู่: รี-publish event (raw → `raw.created`, processed → `processed.created`)
   * ถ้าไม่อยู่: อัปเดต status เป็น `'failed'`

ปรับ threshold ผ่าน env:

```env
RECONCILE_PENDING_THRESHOLD_MS=300000      # 5 นาที
RECONCILE_PROCESSING_THRESHOLD_MS=600000   # 10 นาที
RECONCILE_INTERVAL_MS=60000
```

---

## 📁 โครงสร้างหลักที่เกี่ยวข้อง

* `src/server.ts` — entrypoint, init DB, start watchers + reconciliation, health endpoint
* `src/services/watchRawBucket.service.ts` — core watcher logic (ทั้ง raw + processed)
* `src/services/imageObjects.service.ts` — upsert / query `image_objects`
* `src/services/device.service.ts` — หา/สร้าง `Device`
* `src/services/reconciliation.service.ts` — logic ตรวจสอบและแก้ไข stuck objects
* `src/utils/minioClient.ts` — wrapper client สำหรับ MinIO (parse endpoint, credentials)
* `src/utils/rabbitmqClient.ts` — connection + channel management ไปยัง RabbitMQ
* `src/models/` — TypeORM entities (`Device`, `ImageObject`, `TemperatureReading` ถ้ามี)

---

## 🪪 Environment Variables (summary)

| Name                                                                                                          | Required  | Description                             |
| ------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| `WATCHER_SERVICE_PORT`                                                                                        | ✅         | พอร์ตที่ service ฟัง                    |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SCHEMA`                                        | ✅         | PostgreSQL connection                   |
| `MINIO_ENDPOINT`                                                                                              | ✅         | URL ของ MinIO (ex: `http://minio:9000`) |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`                                                                     | ✅         | credential สำหรับ MinIO                 |
| `MINIO_RAW_BUCKET`, `MINIO_PROCESSED_BUCKET`                                                                  | ✅         | ชื่อ bucket ที่เฝ้า                     |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `RABBITMQ_EXCHANGE` | ✅         | RabbitMQ connection และ exchange        |
| `RAW_ROUTING_KEY`, `PROCESSED_ROUTING_KEY`                                                                    | ✅         | routing key ที่จะ publish event         |
| `NODE_ENV`                                                                                                    | ❌ (แนะนำ) | เพื่อเปิด debug logs (`development`)    |

---

## 🐞 Troubleshooting

### ❌ AccessDenied จาก MinIO

* ตรวจว่าค่า `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` หรือ `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` ถูก inject เข้ามาจริง:
  `docker-compose exec watcher_service env | grep MINIO`
* ตรวจว่า `minioClient.ts` parse endpoint ถูกต้อง (`http://minio:9000`)
* ถ้าใช้ user ที่ไม่ใช่ root ต้องตรวจ policy ให้มีสิทธิ์ `list`, `get`, และ notification access

### ❌ Foreign key violation (device\_id)

* แปลว่า `deviceId` ที่ใช้เป็น placeholder (เช่น 0) ยังไม่ได้แมปเป็น device จริง
* ต้อง implement หรือแก้ `parseDeviceUIDFromObjectKey` ให้ดึง `device_uid` จากชื่อไฟล์ / metadata แล้วเรียก `getOrCreateDeviceByUID`

### ❌ Healthcheck failed / Unhealthy

* ตรวจพอร์ตที่ service ฟัง (`Effective PORT:` log) ให้ตรงกับที่แมปใน Docker
* ตรวจ log ว่า `/health` ถูก hit หรือไม่
* เพิ่ม timeout ใน docker-compose healthcheck ชั่วคราวเพื่อดีบัก

### ❌ RabbitMQ ไม่ส่ง event

* ตรวจว่า exchange ถูกสร้าง (`assertExchange`)
* ดูว่า `publish` ไม่ error (ดู log)
* ตรวจ consumer หรือ queue binding ถูกต้องกับ routing key ที่ส่ง

---

## 🧪 การทดสอบ

* สร้างไฟล์ dummy แล้ว upload เข้า `thermo-raw` ผ่าน `mc` หรือ S3 API
* ดู log ว่า:

  * Device ถูกสร้างหรือถูกค้นหา
  * ImageObject ถูก upsert
  * Event ถูก publish ไป RabbitMQ
* ตรวจใน DB: `SELECT * FROM thermo.image_objects ORDER BY created_at DESC LIMIT 5;`
* ตรวจ message queue: consumer แบบชั่วคราว subscribe บน exchange/routing key

---

## 📦 Deployment Tips

* อย่าเปิด `synchronize: true` ใน production; จัด schema ผ่าน migration / SQL script
* ใช้ healthcheck เพื่อให้ orchestrator (Docker, Kubernetes) รู้สถานะ
* เก็บ metrics (event count, reconcile hits, failures) เพื่อมอนิเตอร์ระยะยาว
* เพิ่ม retry/backoff สำหรับการเชื่อมต่อกับ MinIO / RabbitMQ (ถ้ายังไม่มี)

---

## 🧩 ขยายต่อได้

* ทำให้ `device_uid` ได้จาก metadata แทนชื่อไฟล์โดยตรง
* เพิ่มกับดัก (circuit breaker) สำหรับ RabbitMQ / MinIO
* ทำ metrics export (Prometheus) และ dashboard
* เพิ่ม dead-letter queue สำหรับ event ที่ retry แล้วล้มเหลว

---

ถ้าคุณอยากให้ผมสร้างเวอร์ชันที่มี:

* ตัวอย่าง `.env` แยก dev/production
* Script สำหรับ local test (เช่น upload dummy + assert event)
* ตัว consumer แบบง่าย ๆ (เช็ก message จาก RabbitMQ)

บอกมาได้เลยครับ.
