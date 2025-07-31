// src/utils/minioClient.ts

import { Client } from 'minio';
import {
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
} from '../configs/config';

export const minioClient = new Client({
  endPoint: MINIO_ENDPOINT.split(':')[0],
  port: parseInt(MINIO_ENDPOINT.split(':')[1], 10),
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});
