//src/utils/dataSource.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { Device, TemperatureReading } from '../models';

// โหลด .env (ถ้าไฟล์อยู่ด้านบนไม่เจอ ก็ fallback)
dotenv.config({ path: join(__dirname, '../../../../.env') });

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'thermosense_db';

// NOTE: ปรับ schema ให้ตรงกับที่ใช้ใน database จริง (เช่น 'thermo' หรือ 'smart_farming')
const SCHEMA_NAME = process.env.DB_SCHEMA || 'thermo';

console.log('Loaded env vars for DB connection:');
console.log('DB_HOST:', DB_HOST);
console.log('DB_PORT:', DB_PORT);
console.log('DB_USER:', DB_USER);
console.log('DB_PASSWORD raw:', process.env.DB_PASSWORD, 'typeof:', typeof process.env.DB_PASSWORD);
console.log('DB_NAME:', DB_NAME);
console.log('DB_SCHEMA:', SCHEMA_NAME);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  schema: SCHEMA_NAME,
  entities: [Device, TemperatureReading],
  synchronize: false, // true เฉพาะ dev; ใช้ migration ใน production
  logging: false,
});
