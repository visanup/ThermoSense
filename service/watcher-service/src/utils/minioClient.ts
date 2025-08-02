// src/utils/minioClient.ts

import { Client } from 'minio';
import {
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
} from '../configs/config';

let endPoint: string;
let port: number;
let useSSL: boolean;

try {
  const url = new URL(MINIO_ENDPOINT);
  endPoint = url.hostname;
  port = url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80;
  useSSL = url.protocol === 'https:';
} catch (e) {
  // Fallback: allow shorthand like "minio:9000"
  const parts = MINIO_ENDPOINT.split(':');
  endPoint = parts[0];
  port = parts[1] ? parseInt(parts[1], 10) : 9000;
  useSSL = false;
}

export const minioClient = new Client({
  endPoint,
  port,
  useSSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});
