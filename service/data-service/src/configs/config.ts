// services/data-service/src/configs/config.ts
import * as dotenv from 'dotenv';
import { join } from 'path';
import { Algorithm } from 'jsonwebtoken';

// โหลดค่าจากไฟล์ .env.common (อยู่ที่ services/.env.common)
dotenv.config({ path: join(__dirname, '../../../../.env') });

// 4) Database settings
export const DB_HOST = process.env.DB_HOST!;
export const DB_PORT = Number(process.env.DB_PORT) || 5432;
export const DB_NAME = process.env.DB_NAME!;
export const DB_USER = process.env.DB_USER!;
export const DB_PASSWORD = process.env.DB_PASSWORD!;

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD, process.env.DB_PASSWORD ? '[REDACTED]' : '<missing>');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_SCHEMA:', process.env.DB_SCHEMA);


export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

// 5) Server port
export const PORT = Number(process.env.DATA_SERVICE_PORT) || 5103;
console.log("Port:", PORT)

// 6) JWT settings
const secret = process.env.JWT_SECRET_KEY;
if (!secret) {
  console.error('❌ Missing JWT_SECRET_KEY! Check your .env files and paths.');
  process.exit(1);
}
export const JWT_SECRET = process.env.JWT_SECRET_KEY!;

export const ACCESS_TOKEN_EXPIRE_MINUTES =
  Number(process.env.TOKEN_EXPIRATION_MINUTES) || 1440;

export const REFRESH_TOKEN_EXPIRE_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 7;

// 7) Algorithm (fixed syntax)
export const ALGORITHM: Algorithm =
  (process.env.ALGORITHM as Algorithm) || 'HS256';