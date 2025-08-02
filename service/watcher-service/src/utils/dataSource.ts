// service\watcher-service\src\utils\dataSource.ts
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import { ImageObject } from '../models/objectRecord.model';
import { Device } from '../models/devices.model';

// โหลด .env (fallback ไปที่ project root) แต่ไม่ exit ถ้าไม่เจอ — ใช้ env vars แทน
const envPath = process.env.ENV_PATH || resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`⚠️ .env file not found at path: ${envPath}, falling back to environment variables`);
  }
}

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
  console.log('🛠 DataSource env resolution:');
  console.log('  .env path:', envPath);
  console.log('  DB_HOST:', DB_HOST);
  console.log('  DB_PORT:', DB_PORT);
  console.log('  DB_USER present:', !!DB_USER);
  console.log('  DB_PASSWORD present:', !!DB_PASSWORD);
  console.log('  DB_NAME:', DB_NAME);
  console.log('  DB_SCHEMA:', SCHEMA_NAME);
  console.log('  DATABASE_URL provided:', !!process.env.DATABASE_URL);
}

// validation (ถ้าไม่มี DATABASE_URL ต้องมี user/password)
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

const baseEntities = [Device, ImageObject];

const common: Partial<DataSourceOptions> = {
  type: 'postgres',
  synchronize: false,
  logging: false,
  entities: baseEntities,
};

let options: DataSourceOptions;

if (DATABASE_URL) {
  options = {
    ...common,
    // @ts-ignore because url is allowed when DATABASE_URL is present
    url: DATABASE_URL,
    extra: {
      options: `-c search_path=${SCHEMA_NAME}`,
    },
  } as DataSourceOptions;
} else {
  options = {
    ...common,
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    schema: SCHEMA_NAME,
  } as DataSourceOptions;
}

export const AppDataSource = new DataSource(options);