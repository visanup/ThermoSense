// services/data-service/src/configs/config.ts

import * as dotenv from 'dotenv';
import { join } from 'path';

// โหลด .env ถ้ามี (fallback ไปใช้ environment vars ถ้าไม่มี)
const envPath = join(__dirname, '../../../../.env');
dotenv.config({ path: envPath });

// Database
export const DB_HOST = process.env.DB_HOST || '127.0.0.1';
export const DB_PORT = Number(process.env.DB_PORT || 5432);
export const DB_NAME = process.env.DB_NAME || 'thermosense_db';
export const DB_USER = process.env.DB_USER || 'postgres';
export const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Connection URL (optional override)
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

// Service port — ปรับให้ใช้ตัวแปรที่เหมาะสม (ถ้านี่คือ data-service อาจใช้ DATA_SERVICE_PORT)
export const PORT = Number(process.env.WATCHER_SERVICE_PORT || 5105);

// MinIO (ควรตรวจสอบให้ครบถ้วนถ้าจำเป็น)
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || '';
export const MINIO_ACCESS_KEY =
  process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
export const MINIO_SECRET_KEY =
  process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';
export const MINIO_RAW_BUCKET = process.env.MINIO_RAW_BUCKET || '';
export const MINIO_PROCESSED_BUCKET = process.env.MINIO_PROCESSED_BUCKET || '';

if (!MINIO_RAW_BUCKET) {
  console.error('❌ Missing MINIO_RAW_BUCKET');
  process.exit(1);
}
if (!MINIO_PROCESSED_BUCKET) {
  console.error('❌ Missing MINIO_PROCESSED_BUCKET');
  process.exit(1);
}


// RabbitMQ
export const RABBITMQ_HOST = process.env.RABBITMQ_HOST || '127.0.0.1';
export const RABBITMQ_PORT = Number(process.env.RABBITMQ_PORT || 5672);
export const RABBITMQ_USER = process.env.RABBITMQ_USER || '';
export const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || '';
export const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';
export const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'thermo_exchange';
export const RAW_ROUTING_KEY = process.env.RAW_ROUTING_KEY || 'raw.created';
export const PROCESSED_ROUTING_KEY = process.env.PROCESSED_ROUTING_KEY || 'processed.created'; // fixed typo

// Debug logs (เฉพาะ non-production)
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
if (!isProd) {
  console.log('Config loaded:');
  console.log({
    DB_HOST,
    DB_PORT,
    DB_NAME,
    PORT,
    MINIO_RAW_BUCKET,
    MINIO_PROCESSED_BUCKET,
    RABBITMQ_EXCHANGE,
    RAW_ROUTING_KEY,
    PROCESSED_ROUTING_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });
}

