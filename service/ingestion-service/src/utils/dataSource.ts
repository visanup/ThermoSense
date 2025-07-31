// services/economic-service/src/utils/dataSource.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import { ImageObject } from '../models/imageObjects.model';
import { Device } from '../models/devices.model'; // ต้องมีไฟล์นี้ด้วย

// โหลด .env (fallback ไปที่ project root)
const envPath = process.env.ENV_PATH || resolve(__dirname, '../../../../.env');
if (!fs.existsSync(envPath)) {
  console.error(`❌ .env file not found at path: ${envPath}`);
  process.exit(1);
}
dotenv.config({ path: envPath });

// ดึงค่าจาก env
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'thermosense_db';
const SCHEMA_NAME = process.env.DB_SCHEMA || 'thermo';
const DATABASE_URL = process.env.DATABASE_URL || '';

// debug (เฉพาะ non-production)
if (process.env.NODE_ENV !== 'production') {
  console.log('🛠 IngestionService DataSource env resolution:');
  console.log('  .env path:', envPath);
  console.log('  DB_HOST:', DB_HOST);
  console.log('  DB_PORT:', DB_PORT);
  console.log('  DB_USER present:', !!DB_USER);
  console.log('  DB_PASSWORD present:', !!DB_PASSWORD);
  console.log('  DB_NAME:', DB_NAME);
  console.log('  DB_SCHEMA:', SCHEMA_NAME);
  console.log('  DATABASE_URL provided:', !!process.env.DATABASE_URL);
}

// validation
if (!DATABASE_URL) {
  if (!DB_USER) {
    console.error('❌ Missing DB_USER and no DATABASE_URL provided.');
    process.exit(1);
  }
  if (!DB_PASSWORD) {
    console.error('❌ Missing DB_PASSWORD and no DATABASE_URL provided.');
    process.exit(1);
  }
}

const options: any = {
  type: 'postgres',
  synchronize: false,
  logging: false,
  entities: [Device, ImageObject],
};

if (DATABASE_URL) {
  options.url = DATABASE_URL;
  options.extra = { options: `-csearch_path=${SCHEMA_NAME}` };
} else {
  options.host = DB_HOST;
  options.port = DB_PORT;
  options.username = DB_USER;
  options.password = DB_PASSWORD;
  options.database = DB_NAME;
  options.schema = SCHEMA_NAME;
}

export const AppDataSource = new DataSource(options);
