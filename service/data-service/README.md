# ThermoSense Data Service

บริการนี้จัดการข้อมูลอุปกรณ์และค่าการอ่านอุณหภูมิ (temperature readings) จากระบบ ThermoSense / IncuSense  
ออกแบบเป็น microservice ด้วย Express + TypeORM + PostgreSQL พร้อม JWT-based authentication

## 🧠 Overview

Flow หลักของบริการนี้:
- รับข้อมูลอุปกรณ์ (Device) และการอ่านค่าอุณหภูมิ (TemperatureReading)
- เก็บ metadata ของภาพจาก MinIO ผ่าน service อื่น (ingestion / processing / OCR)
- ให้ API สำหรับ frontend และระบบอื่น ๆ ดึงข้อมูล
- ปกป้องด้วย JWT token (stubable / extensible)

## 🔧 Prerequisites

- Node.js >= 18  
- Yarn  
- PostgreSQL (มี schema `thermo` หรือแก้ชื่อให้ตรง)  
- .env file ที่ตั้งค่าตามด้านล่าง  
- (ไม่บังคับแต่แนะนำ) ts-node-dev สำหรับ dev

## 📁 โครงสร้างโดยย่อ

```

src/
configs/
config.ts
utils/
dataSource.ts
models/
devices.model.ts
temperatureReading.model.ts
index.ts
services/
devices.service.ts
temperatureReading.service.ts
routes/
devices.route.ts
temperatureReading.route.ts
index.ts
middlewares/
auth.ts
errorHandler.ts
server.ts

````

## 🛠️ Setup (Local Development)

### 1. Clone และติดตั้ง

```bash
git clone <repo-url>
cd service/data-service
yarn install
````

### 2. สร้างไฟล์ `.env` ที่ root ของ `D:\ThermoSense\.env` (ตัวอย่าง)

```env
# Database
DB_HOST=192.168.1.104
DB_PORT=5432
DB_NAME=thermosense_db
DB_USER=postgres
DB_PASSWORD=password
DB_SCHEMA=thermo

# Service port
DATA_SERVICE_PORT=5103

# JWT
JWT_SECRET_KEY=your_jwt_secret_here
TOKEN_EXPIRATION_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256

# CORS (optional overrides)
CORS_ALLOWED_ORIGINS=*
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=*
CORS_ALLOW_HEADERS=*
```

> **หมายเหตุ:** ต้องแน่ใจว่าไฟล์ `.env` ไม่มี BOM, ไม่มี `"` ล้อมค่า, และไม่มี whitespace แปลกๆ เช่น:
> `DB_PASSWORD=password` (ไม่ใช่ `DB_PASSWORD= password` หรือ `DB_PASSWORD="password"`)

### 3. คอมไพล์

```bash
yarn build
```

### 4. รัน

```bash
yarn start
```

จะเห็น log ว่าเชื่อมต่อฐานข้อมูลและรันที่พอร์ต เช่น:

```
🚀 Server is running on http://localhost:5103
```

## ⚙️ Configuration

สำคัญที่อ่านจาก `.env` ผ่าน `src/configs/config.ts` และ `src/utils/dataSource.ts`:

* `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SCHEMA` — เชื่อมต่อ PostgreSQL
* `JWT_SECRET_KEY` — ใช้เซ็น token
* `DATA_SERVICE_PORT` — พอร์ตของ service
* CORS flags — ปรับการเข้าถึงจาก frontend

## 🗃️ Database

ใช้ PostgreSQL schema `thermo` (หรือกำหนดผ่าน `DB_SCHEMA`)
ตารางหลัก:

* `devices` — ข้อมูลอุปกรณ์
* `temperature_readings` — ค่าการอ่านอุณหภูมิที่เชื่อมโยงกับอุปกรณ์

**หมายเหตุ:** ปัจจุบัน `synchronize` ถูกปิดไว้ (`false`) — แนะนำให้ใช้ migration จริงจังก่อน deploy

## 🔐 Authentication

JWT token-based authentication middleware `authenticateToken`
ทุก endpoint ภายใต้ `/api` ต้องมี header:

```
Authorization: Bearer <token>
```

(ระบบ login/refresh ยังเป็น placeholder — ต้องเพิ่ม auth service หรือ stub token เองสำหรับ dev)

ตัวอย่างสร้าง token แบบง่ายด้วย Node REPL:

```js
import jwt from 'jsonwebtoken';
const token = jwt.sign({ sub: 'some-user-id' }, 'your_jwt_secret_here', { algorithm: 'HS256', expiresIn: '1d' });
console.log(token);
```

## 🚀 API Reference

Base path: `/api`

### 1. Devices

#### `POST /api/devices`

สร้าง device ใหม่
Body:

```json
{
  "device_uid": "incu-01",
  "name": "Incubator #1",
  "device_type": "incubator",
  "location": "Lab A"
}
```

Response: `201` device object

#### `GET /api/devices`

ดึงรายชื่อ device
Query params: `limit`, `offset`

#### `GET /api/devices/:id`

ดึง device ตาม ID

#### `PATCH /api/devices/:id`

อัปเดต device

#### `DELETE /api/devices/:id`

ลบ device

### 2. Temperature Readings

#### `POST /api/temperature-readings`

สร้าง reading
Body:

```json
{
  "device_uid": "incu-01",
  "recorded_at": "2025-07-31T10:15:00Z",
  "temperature": "37.500",
  "raw_image_id": 123,
  "processed_image_id": 456
}
```

Response: `201` reading object

#### `GET /api/temperature-readings`

List readings
Query params:

* `device_uid`
* `limit`
* `offset`

#### `GET /api/temperature-readings/:id`

อ่าน reading เดียว

#### `PATCH /api/temperature-readings/:id`

อัปเดต

#### `DELETE /api/temperature-readings/:id`

ลบ

### 3. Health-check

`GET /health`
ตอบกลับ `200 OK` กับ `{ status: "ok", ts: "<timestamp>" }`

## 🧪 Development Helpers

* ใช้ `ts-node-dev` สำหรับรันแบบ hot-reload:

  ```bash
  yarn dev
  ```

* เพิ่ม validation (เช่น `zod` หรือ `class-validator`) ใน service/route เพื่อความเข้มงวดของ input

## 🧰 Error Handling

ทุก error จะถูกจับโดย global error handler และตอบ:

```json
{
  "error": "message",
  "stack": "..." // เฉพาะ non-production
}
```

404 fallback:

```json
{ "error": "not found" }
```

## 📦 Example cURL

สร้าง device:

```bash
curl -X POST http://localhost:5103/api/devices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"device_uid":"incu-01","name":"Incubator 1"}'
```

ดึง readings:

```bash
curl "http://localhost:5103/api/temperature-readings?device_uid=incu-01&limit=10" \
  -H "Authorization: Bearer <token>"
```

## 🔄 Integration Points

* **MinIO**: ภาพถูกจัดเก็บภายนอก; service อื่น (ingestion/processing) จะสร้าง `image_objects` และอ้างอิงใน readings
* **RabbitMQ**: event-driven workflow (raw\.created → processing → processed.created → OCR)
* **MQTT**: ข้อมูลภาพจาก ESP32-CAM ถูกส่งมาที่ ingestion service ก่อนอัปโหลดไป MinIO

## 🧩 Environment Overrides

สามารถกำหนดไฟล์อื่นโดยตั้งตัวแปร:

```bash
export ENV_PATH=/custom/path/.env
```

## 🛠️ Troubleshooting

* `client password must be a string`: ตรวจสอบว่า `DB_PASSWORD` ใน `.env` ถูกโหลดจริง (ไม่มี quotes/space) และมี log debug ของ `dataSource.ts` แสดงว่าได้ค่า
* เชื่อมต่อ DB ไม่ได้: ตรวจสอบว่า Postgres รันอยู่, schema ถูกสร้าง, ค่าฐานข้อมูลใน `.env` ถูกต้อง
* JWT invalid: เช็ก `JWT_SECRET_KEY` ตรงกับที่ใช้เซ็น token

## 🧩 To Do / Improvements

* เพิ่มระบบ login / refresh token
* ใช้ migration tool (เช่น TypeORM migrations) แทน `synchronize`
* เพิ่ม request validation (Zod / class-validator)
* กำหนด rate-limiting ต่อ IP / user
* เพิ่ม metrics & tracing (Prometheus / OpenTelemetry)

## 🧭 Deployment

1. ตั้งค่า `.env` บนเครื่องจริง
2. build: `yarn build`
3. รัน: `yarn start` (หรือใช้ process manager เช่น PM2 / systemd)
4. ตั้ง health-check และ restart policy

## 🧾 License

MIT (ปรับได้ตามนโยบายองค์กร)

```

ถ้าต้องการ version ที่ย่อยเป็น template / เพิ่ม badge, ตัวอย่าง `.env.example`, หรือ integration diagram ผมเขียนให้ต่ออีกชุดได้เลยครับ.
```
