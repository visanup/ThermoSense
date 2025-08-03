// services/data-service/src/configs/config.ts
// --- File: services/data-service/src/configs/config.ts ---
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { Algorithm } from 'jsonwebtoken';

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

export const DB_HOST = process.env.DB_HOST!;
export const DB_PORT = Number(process.env.DB_PORT) || 5432;
export const DB_NAME = process.env.DB_NAME!;
export const DB_USER = process.env.DB_USER!;
export const DB_PASSWORD = process.env.DB_PASSWORD!;

console.log('[Config] Using .env from:', envPath || '<default env>');
console.log('DB_HOST:', DB_HOST);
console.log('DB_PORT:', DB_PORT);
console.log('DB_USER:', DB_USER);
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD, process.env.DB_PASSWORD ? '[REDACTED]' : '<missing>');
console.log('DB_NAME:', DB_NAME);
console.log('DB_SCHEMA:', process.env.DB_SCHEMA);

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

export const PORT = Number(process.env.DATA_SERVICE_PORT) || 5103;
console.log('Port:', PORT);

const secret = process.env.JWT_SECRET_KEY;
if (!secret) {
  console.error('❌ Missing JWT_SECRET_KEY! Check your .env files and paths.');
  process.exit(1);
}
export const JWT_SECRET = secret;

export const ACCESS_TOKEN_EXPIRE_MINUTES =
  Number(process.env.TOKEN_EXPIRATION_MINUTES) || 1440;

export const REFRESH_TOKEN_EXPIRE_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 7;

export const ALGORITHM: Algorithm =
  (process.env.ALGORITHM as Algorithm) || 'HS256';