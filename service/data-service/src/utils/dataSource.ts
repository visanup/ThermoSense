// --- File: src/utils/dataSource.ts ---
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { Device, TemperatureReading, ImageObject } from '../models';

function locateEnvFile(filename = '.env'): string | undefined {
  if (process.env.ENV_PATH) {
    return process.env.ENV_PATH;
  }

  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = join(currentDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
    currentDir = dirname(currentDir);
  }
  return undefined;
}

const envPath = locateEnvFile();
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'thermosense_db';
const SCHEMA_NAME = process.env.DB_SCHEMA || 'thermo';

console.log('[DataSource] Using .env from:', envPath || '<default env>');
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
  entities: [Device, TemperatureReading, ImageObject],
  synchronize: false,
  logging: false,
});