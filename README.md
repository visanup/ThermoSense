# ThermoSense

ระบบ ThermoSense (หรือ IncuSense) เป็นแพลตฟอร์ม IoT + LLM สำหรับเก็บ วิเคราะห์ และแสดงผลค่าการอ่านอุณหภูมิจากอุปกรณ์ เช่น ตู้ Incubator โดยใช้กล้องจับภาพหน้าจอ → เก็บภาพใน MinIO → ประมวลผล (processing + OCR/LLM) → บันทึกลงฐานข้อมูล → แสดงผลผ่านแดชบอร์ด

---

## โครงสร้างโปรเจกต์

```

ThermoSense/
├── db/
│   ├── authen\_db.sql          # สร้าง schema/ตารางสำหรับ authentication
│   └── thermo.sql             # Schema หลัก (devices, readings, image metadata)
├── docs/                      # เอกสารประกอบ (architecture, design, how-tos)
├── frontend/                  # Frontend dashboard
├── sensor/                    # โค้ดฝั่ง ESP32-CAM หรืออุปกรณ์ edge
├── service/
│   ├── auth-service           # Authentication (JWT login/refresh)
│   ├── data-service           # API เก็บ/อ่านข้อมูล device & readings
│   ├── ingestion-service      # รับภาพจาก MQTT → upload raw image ไป MinIO
│   ├── minIO-service          # Object storage (MinIO)
│   ├── processing-service     # ปรับภาพ (crop/normalize/etc.)
│   ├── ocr-service            # อ่านภาพ processed → OCR/LLM → สกัดค่าอุณหภูมิ
│   ├── rabbitMQ-service       # Message broker / event routing
├── .env                      # ค่าคอนฟิกรวม (DB, MinIO, RabbitMQ, JWT, ฯลฯ)
├── docker-compose.yml        # รัน environment แบบครบด้วย Docker Compose (ถ้ามี)
└── README.md                # เอกสารนี้

````

---

## 🧠 Architecture Overview

1. **ESP32-CAM / Sensor** ถ่ายภาพหน้าจอแสดงอุณหภูมิของ incubator เป็นระยะ ๆ แล้วส่งผ่าน MQTT  
2. **MQTT Broker** รับ payload ภาพ → ส่งต่อให้ `ingestion-service`  
3. **Ingestion-Service** อัปโหลดภาพดิบ (raw) ไปยัง MinIO (`thermo-raw` bucket) และ publish event ไปยัง RabbitMQ (`raw.created`)  
4. **Processing-Service** ฟัง event `raw.created` → ดึงภาพ raw มา preprocess (crop/normalize) → อัปโหลดผลไปยัง MinIO (`thermo-processed`) → publish event `processed.created`  
5. **OCR-Service** ฟัง event `processed.created` → ดึงภาพ processed มาอ่านด้วย OCR/LLM → สกัดค่าอุณหภูมิ, metadata ฯลฯ → บันทึกลง PostgreSQL (ผ่าน `data-service` หรือเขียนโดยตรง)  
6. **Data-Service** ให้ API สำหรับดึงข้อมูล devices และ readings (รวม reference ถึงภาพ raw/processed)  
7. **Auth-Service** ดูแล JWT issuance/validation เพื่อปกป้อง API  
8. **Frontend** แสดง dashboard ที่ดึงข้อมูลจาก `data-service`  
9. **MinIO** เก็บภาพทั้ง raw/processed และให้ event notification  
10. **RabbitMQ** ขับเคลื่อน workflow แบบ event-driven ผ่าน routing keys

---

## 🛠 Prerequisites

- Git  
- Node.js >= 18  
- Yarn  
- PostgreSQL (สร้าง database และ schema ด้วย SQL ใน `db/thermo.sql`)  
- RabbitMQ  
- MinIO  
- ESP32-CAM / Edge sensor  
- (ถ้าใช้) Docker & Docker Compose  

---

## ⚙️ การตั้งค่า

### 1. สร้างไฟล์ `.env` ที่ root (`ThermoSense/.env`) เช่น:

```env
## Database
DB_HOST=192.168.1.104
DB_PORT=5432
DB_NAME=thermosense_db
DB_USER=postgres
DB_PASSWORD=password
DB_SCHEMA=thermo

## Ports
DATA_SERVICE_PORT=5103
AUTH_SERVICE_PORT=5100
INGRESTION_SERVICE_PORT=5101
PROCESSING_SERVICE_PORT=5102

## JWT
JWT_SECRET_KEY=your_jwt_secret_here
TOKEN_EXPIRATION_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256

## MinIO
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=supersecret
MINIO_RAW_BUCKET=thermo-raw
MINIO_PROCESSED_BUCKET=thermo-processed

## RabbitMQ
RABBITMQ_HOST=127.0.0.1
RABBITMQ_PORT=5672
RABBITMQ_VHOST=/thermo
RABBITMQ_USER=ingestion_user
RABBITMQ_PASSWORD=strongP@ss1
RABBITMQ_EXCHANGE=thermo_exchange
RABBITMQ_QUEUE_RAW=raw_created
RABBITMQ_QUEUE_PROCESSED=processed_created
````

> ตรวจสอบ:
>
> * ไม่มี quotes ล้อมค่า (เช่น `DB_PASSWORD="password"` ผิด)
> * ไม่มี BOM (ใช้ UTF-8 without BOM)
> * ไม่มี whitespace แปลก ๆ รอบค่า

---

## 📦 การติดตั้งและรันแต่ละ Service

### 1. สร้างฐานข้อมูล & schema

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/thermo.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/authen_db.sql  # ถ้ามี
```

### 2. MinIO (local)

ดูใน `docs` หรือใช้ script ที่ service:

```bash
# ติดตั้ง mc แล้วตั้ง alias
mc alias set local http://localhost:9000 admin supersecret

# สร้าง buckets
mc mb local/thermo-raw
mc mb local/thermo-processed

# ตั้ง lifecycle policy
mc ilm add local/thermo-raw --expiry-days 30
```

### 3. RabbitMQ

* สร้าง vhost `/thermo`
* สร้าง user (เช่น `ingestion_user`) และกำหนด permission
* สร้าง exchange `thermo_exchange`
* สร้าง queues `raw_created`, `processed_created` แล้ว bind กับ routing keys `raw.created`, `processed.created`

### 4. รันแต่ละ service (ตัวอย่าง data-service)

```bash
cd service/data-service
yarn install
yarn build
yarn start
```

ทำซ้ำกับ:

* `auth-service`
* `ingestion-service`
* `processing-service`
* `ocr-service`
* `rabbitMQ-service` (ถ้าเป็น custom wrapper/management)
* `frontend` (ตาม stack ที่ใช้)

---

## 🧪 Workflow แบบ Event-driven (อัปเดตรวม OCR)

* `MinIO` ยิง event `s3:ObjectCreated:Put` ไปยัง RabbitMQ ผ่านการตั้งค่า notification
* Routing:

  * `raw.created` → `processing-service`
  * `processed.created` → `ocr-service`
* `ocr-service` ส่งผลลัพธ์ (ค่าอุณหภูมิ + metadata) ไปที่ PostgreSQL
* `data-service` เปิด API ให้ frontend ดึงข้อมูล

---

## 🔐 Authentication

* ใช้ JWT token
* `auth-service` จัดการ issue / refresh token
* ทุก endpoint ภายใต้ `/api` ใน service ต่าง ๆ ควรตรวจ token header:

```
Authorization: Bearer <token>
```

---

## 🧩 Integration Points

* **ESP32-CAM** → MQTT → Ingestion
* **MinIO** แยก raw/processed images + notifications
* **RabbitMQ** routing events ระหว่าง service
* **OCR-Service** สกัดข้อมูลจากภาพ processed
* **PostgreSQL** เก็บ readings + metadata
* **Frontend** ดึงจาก `data-service`
* **Auth-Service** ปกป้อง API

---

## 🧰 คำสั่งช่วยพัฒนา

ตัวอย่างในแต่ละ service (เมื่ออยู่ในโฟลเดอร์):

```bash
yarn install
yarn dev        # ถ้ามี hot reload
yarn build
yarn start
```

---

## 🛠 Troubleshooting

| ปัญหา                              | สาเหตุที่เป็นไปได้                   | แนวทางแก้ไข                                                                   |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `client password must be a string` | DB\_PASSWORD ไม่ได้ถูกโหลดจาก `.env` | ตรวจ path ของ `.env`, encoding, ค่าในไฟล์, ลอง override เป็น env var ชั่วคราว |
| ไม่เห็นภาพเดินผ่าน pipeline        | notification / binding ผิด           | ตรวจ MinIO event config & RabbitMQ bindings                                   |
| OCR ไม่ออกผล                       | ภาพไม่ชัด / preprocessing ผิด        | ดู log ของ processing-service และ ocr-service                                 |
| JWT invalid                        | secret mismatch หรือหมดอายุ          | ตรวจ `JWT_SECRET_KEY` และสร้าง token ใหม่                                     |
| Service ไม่เชื่อม DB               | config ผิด / schema ไม่ตรง           | ตรวจ `dataSource` log, ตรวจว่า schema `thermo` มีอยู่                         |

---

## 📝 Best Practices / Next Steps

* ใช้ migration แทน `synchronize` (TypeORM หรือ tool อื่น)
* เพิ่ม validation บน input (Zod / class-validator)
* เก็บ metrics & tracing (Prometheus, OpenTelemetry)
* เพิ่ม retries / dead-letter queue สำหรับ RabbitMQ
* เพิ่ม monitoring/log aggregation (Grafana/Loki, ELK)
* แยก secrets โดยใช้ vault หรือ environment-specific config

---

## 🧑‍🤝‍🧑 Contributing

1. Fork repo
2. สร้าง branch: `feature/xxx`
3. เขียนโค้ด + เพิ่ม test
4. เปิด PR พร้อมคำอธิบายและวิธีทดสอบ

---

## 📦 Deployment

* ตั้ง `.env` บนเครื่องเป้าหมาย
* รัน `yarn build` แล้ว `yarn start` สำหรับแต่ละ service
* ใช้ process manager (เช่น systemd / PM2)
* ตั้ง health-check, restart policy, และ backup DB

---

## 📚 References

* MinIO Quickstart Guide: [https://docs.min.io/docs/minio-quickstart-guide](https://docs.min.io/docs/minio-quickstart-guide)
* PostgreSQL Documentation
* RabbitMQ Official Docs
* TypeORM Docs

---

## 🪪 License

กำหนดตามนโยบายองค์กร (แนะนำ MIT หรือ internal license)

```

ถ้าต้องการแยก README ย่อยให้แต่ละ service (เช่น `README.ocr-service.md`) หรือเพิ่ม diagram (Mermaid/SVG) บอกผมได้เลยครับ.
```
