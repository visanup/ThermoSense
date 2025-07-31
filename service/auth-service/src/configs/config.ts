// services/auth-service/src/configs/config.ts
import * as dotenv from 'dotenv';
import { join } from 'path';
import { Algorithm } from 'jsonwebtoken';

// โหลดค่าจากไฟล์ .env (อยู่ที่ services/.env)
dotenv.config({ path: join(__dirname, '../../../../.env') });

export const DB_HOST = process.env.DB_HOST!;
export const DB_PORT = Number(process.env.DB_PORT) || 5432;
export const DB_NAME = process.env.DB_NAME!;
export const DB_USER = process.env.DB_USER!;
export const DB_PASSWORD = process.env.DB_PASSWORD!;

console.log('DB_HOST:', DB_HOST);
console.log('DB_PORT:', DB_PORT);
console.log('DB_NAME:', DB_NAME);
console.log('DB_USER:', DB_USER);

// ถ้ามี DATABASE_URL ใน env ให้ใช้เลย ไม่งั้นสร้างใหม่
export const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
export const PORT = Number(process.env.AUTH_SERVICE_PORT) || 5100;

export const JWT_SECRET = process.env.JWT_SECRET_KEY!;
export const ACCESS_TOKEN_EXPIRE_MINUTES = Number(process.env.TOKEN_EXPIRATION_MINUTES) || 1440;
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 7;
// ระบุชนิด Algorithm ให้ตรงกับ jsonwebtoken
export const ALGORITHM: Algorithm = (process.env.ALGORITHM as Algorithm) || 'HS256';
