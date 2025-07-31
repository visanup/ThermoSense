# auth-service

`auth-service` เป็น microservice สำหรับจัดการ Authentication และ Authorization ด้วย JWT และ Refresh Token ผ่าน PostgreSQL schema `auth`

---

## 🔧 Database Schema

ใช้ database/schema: `auth`

### ตาราง `auth.users`

| Column          | Type           | Constraints               | Description                       |
| --------------- | -------------- | ------------------------- | --------------------------------- |
| `user_id`       | `SERIAL`       | `PRIMARY KEY`             | รหัสผู้ใช้งาน                     |
| `username`      | `VARCHAR(100)` | `UNIQUE NOT NULL`         | ชื่อผู้ใช้งาน                     |
| `password_hash` | `TEXT`         | `NOT NULL`                | รหัสผ่านที่เข้ารหัสไว้            |
| `role`          | `VARCHAR(50)`  | `DEFAULT 'user'`          | สิทธิ์การใช้งาน (e.g. user/admin) |
| `email`         | `VARCHAR(255)` |                           | อีเมล                             |
| `created_at`    | `TIMESTAMPTZ`  | `DEFAULT NOW()`           | วันที่สร้างบัญชี                  |
| `updated_at`    | `TIMESTAMPTZ`  | `DEFAULT NOW()` (trigger) | วันที่แก้ไขล่าสุด                 |

* มี Index บน `username`
* Trigger อัปเดต `updated_at` อัตโนมัติก่อนทุก UPDATE

### ตาราง `auth.user_tokens`

| Column          | Type          | Constraints                                        | Description              |
| --------------- | ------------- | -------------------------------------------------- | ------------------------ |
| `token_id`      | `SERIAL`      | `PRIMARY KEY`                                      | รหัสบันทึก Refresh Token |
| `user_id`       | `INTEGER`     | `REFERENCES auth.users(user_id) ON DELETE CASCADE` | ผู้ใช้งาน                |
| `refresh_token` | `TEXT`        | `UNIQUE NOT NULL`                                  | Refresh Token string     |
| `issued_at`     | `TIMESTAMPTZ` | `DEFAULT NOW()`                                    | วัน-เวลาที่ออก Token     |
| `expires_at`    | `TIMESTAMPTZ` |                                                    | วัน-เวลาที่หมดอายุ       |

* มี Index บน `user_id` และ `refresh_token`

---

## 🚀 การติดตั้ง

1. Clone โปรเจกต์

   ```bash
   git clone <repo-url>
   cd services/auth-service
   ```
2. ติดตั้ง dependencies

   ```bash
   yarn install
   ```
3. สร้างไฟล์ `.env` (ที่โฟลเดอร์ root) และตั้งค่าตามตัวอย่าง

   ```dotenv
   DB_HOST=<your-db-host>
   DB_PORT=<your-db-port>
   DB_USER=<your-db-user>
   DB_PASSWORD=<your-db-password>
   DB_NAME=<your-db-name>        # database ที่มี schema auth
   AUTH_SERVICE_PORT=4120        # หรือพอร์ตที่ต้องการ
   JWT_SECRET_KEY=<your-secret>
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   REFRESH_TOKEN_EXPIRE_DAYS=7
   ```
4. รันบริการ

   ```bash
   yarn dev          # โหมดพัฒนา (ts-node-dev)

   # หรือ build แล้ว run
   yarn build
   yarn start
   ```

---

## 📡 API Endpoints

Base URL:

```
http://<host>:<port>/api/auth
```

ทุกรายการต้องส่ง `Content-Type: application/json`

| # | Purpose                        | Method | URL        | Body Example                                                     | Success Response Example                                                                            | Notes                                          |
| - | ------------------------------ | ------ | ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1 | สมัครสมาชิก (Sign Up)          | POST   | `/signup`  | `{ "email":"u@e.com","username":"user1","password":"P@ssw0rd" }` | `201 Created`<br>`{ "message":"User created","userId":5 }`                                          | เข้ารหัส password และบันทึกใน DB               |
| 2 | เข้าสู่ระบบ (Log In)           | POST   | `/login`   | `{ "username":"user1","password":"P@ssw0rd" }`                   | `200 OK`<br>`{ "accessToken":"...","refreshToken":"...","tokenType":"bearer","userId":5 }`          | คืน Access + Refresh Token และ userId          |
| 3 | ต่ออายุ Access Token (Refresh) | POST   | `/refresh` | `{ "refreshToken":"..." }`                                       | `200 OK`<br>`{ "accessToken":"...","tokenType":"bearer" }`                                          | ตรวจสอบ token ยังไม่ expired                   |
| 4 | Logout (Revoke Refresh Token)  | POST   | `/logout`  | `{ "refreshToken":"..." }`                                       | `204 No Content`                                                                                    | เพิกถอน Refresh Token ใน DB                    |
| 5 | โปรไฟล์ผู้ใช้งานปัจจุบัน (Me)  | GET    | `/me`      | —                                                                | `200 OK`<br>`{ "user_id":5,"username":"user1","email":"u@e.com","role":"user","created_at":"..." }` | ต้องส่ง header `Authorization: Bearer <token>` |

---

## 🔐 Authentication Flow

1. **Sign Up**: ผู้ใช้ส่งข้อมูลสมัคร → บริการเข้ารหัส password (bcrypt) → สร้าง record ใน `auth.users`
2. **Log In**: ตรวจสอบ username/password → สร้าง Access Token + Refresh Token → บันทึกใน `auth.user_tokens`
3. **Refresh**: ผู้ใช้ส่ง Refresh Token → ตรวจสอบ DB (expires\_at) → สร้าง Access Token ใหม่
4. **Logout**: ผู้ใช้ส่ง Refresh Token → ลบ record หรือทำเครื่องหมายเพิกถอนใน `auth.user_tokens`
5. **Get Profile**: ผู้ใช้ส่ง Access Token → ตรวจสอบ JWT → คืนข้อมูลผู้ใช้จาก `auth.users`

---

## 📂 โครงสร้างโฟลเดอร์

```
services/auth-service/
├── src/
│   ├── configs/
│   │   └── config.ts           # โหลด .env และตั้งค่า JWT, DB URL
│   ├── models/
│   │   ├── user.model.ts       # Entity สำหรับ users
│   │   └── refreshToken.model.ts # Entity สำหรับ user_tokens
│   ├── routes/
│   │   ├── index.ts            # รวม router
│   │   └── authRoutes.ts       # เส้นทาง signup, login, refresh, logout, me
│   ├── services/
│   │   └── authService.ts      # โลจิกการสมัคร, เข้าสู่ระบบ, ต่ออายุ, ยกเลิก
│   ├── utils/
│   │   └── swagger.ts          # ตั้งค่า Swagger UI
│   └── server.ts               # สตาร์ท Express + DataSource
├── .env                        # ไฟล์ config (ไม่เก็บใน Git)
├── package.json
└── tsconfig.json
```

---

## 🛠️ ข้อแนะนำเพิ่มเติม

* ใช้ **class-validator** กับ DTO เพื่อ validation เพิ่มเติม
* ทำ **database migrations** ด้วย TypeORM CLI เมื่อ schema เปลี่ยนแปลง
* จัดการ **error handling** ทั้ง service และ controller
* เพิ่ม **rate limiting** หรือ **brute-force protection** สำหรับ endpoint `/login`

---
