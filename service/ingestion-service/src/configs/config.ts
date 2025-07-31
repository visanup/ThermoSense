// services/data-service/src/configs/config.ts
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

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

// Service ports (แก้ชื่อให้ถูก)
export const PORT = Number(process.env.INGESTION_SERVICE_PORT || process.env.INGRESTION_SERVICE_PORT || 5101);

// MQTT
if (!process.env.MQTT_BROKER_URL) {
  console.error('❌ Missing MQTT_BROKER_URL');
  process.exit(1);
}
export const MQTT_URL = process.env.MQTT_BROKER_URL;
export const MQTT_USER = process.env.MQTT_USER || '';
export const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

// MinIO
if (!process.env.MINIO_RAW_BUCKET) {
  console.error('❌ Missing MINIO_RAW_BUCKET');
  process.exit(1);
}
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || '';
export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
export const MINIO_RAW_BUCKET = process.env.MINIO_RAW_BUCKET;

// RabbitMQ
export const RABBITMQ_HOST = process.env.RABBITMQ_HOST || '127.0.0.1';
export const RABBITMQ_PORT = Number(process.env.RABBITMQ_PORT || 5672);
export const RABBITMQ_USER = process.env.RABBITMQ_USER || '';
export const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || '';
export const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';
export const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'thermo_exchange';
export const RAW_ROUTING_KEY = process.env.RAW_ROUTING_KEY || 'raw.created';

// Debug logs (เฉพาะ non-production)
if (process.env.NODE_ENV !== 'production') {
  console.log('Config loaded:');
  console.log({ DB_HOST, DB_PORT, DB_NAME, PORT, MQTT_URL, MINIO_RAW_BUCKET, RABBITMQ_EXCHANGE, RAW_ROUTING_KEY });
}
