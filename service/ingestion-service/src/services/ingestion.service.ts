// src/services/ingestion.service.ts
import { mqttClient } from '../utils/mqttClient';
import { minioClient } from '../utils/minioClient';
import { getChannel } from '../utils/rabbitmqClient';
import {
  MINIO_RAW_BUCKET,
  RABBITMQ_EXCHANGE,
  RAW_ROUTING_KEY,
} from '../configs/config';
import { v4 as uuidv4 } from 'uuid';

interface IncomingPayload {
  device_uid: string;
  recorded_at: string; // ISO string
  image_base64?: string;
  image?: Buffer; // ถ้ามาส่งเป็น binary
  extra_metadata?: Record<string, any>;
}

function parsePayload(buffer: Buffer): IncomingPayload | null {
  try {
    const str = buffer.toString('utf-8');
    const obj = JSON.parse(str);
    // คุณอาจต้องรองรับ base64 image หากมาในฟิลด์ image_base64
    return obj;
  } catch (e) {
    console.warn('Failed to parse MQTT payload as JSON, treating as raw image buffer');
    return null;
  }
}

export class IngestionService {
  constructor() {
    mqttClient.on('connect', () => {
      console.log('✅ MQTT connected');
      mqttClient.subscribe('camera/image', { qos: 1 }, (err) => {
        if (err) console.error('Failed to subscribe to camera/image:', err);
        else console.log('Subscribed to camera/image');
      });
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT error:', err);
    });

    mqttClient.on('message', async (topic, payload) => {
      const traceId = uuidv4();
      try {
        // 1. พยายาม parse payload เป็น structure ที่คาดหวัง
        const parsed = parsePayload(payload);
        let device_uid: string | undefined;
        let recorded_at: string | undefined;
        let imageBuffer: Buffer;

        if (parsed && parsed.image_base64) {
          device_uid = parsed.device_uid;
          recorded_at = parsed.recorded_at;
          imageBuffer = Buffer.from(parsed.image_base64, 'base64');
        } else if (parsed && parsed.image) {
          device_uid = parsed.device_uid;
          recorded_at = parsed.recorded_at;
          imageBuffer = Buffer.from(parsed.image as any);
        } else {
          // ถ้าไม่ใช่ JSON, ถือว่า payload ตรงเป็นภาพ
          imageBuffer = payload;
        }

        // คุณอาจต้องกำหนด device_uid/recorded_at จาก context อื่นถ้า missing
        if (!device_uid) device_uid = 'unknown'; // หรือ reject
        if (!recorded_at) recorded_at = new Date().toISOString();

        const id = uuidv4();
        const objectName = `${id}.jpg`;

        // 2. อัปโหลด raw image ไป MinIO (retry แบบง่าย)
        await minioClient.putObject(MINIO_RAW_BUCKET, objectName, imageBuffer);
        console.log(`[${traceId}] Uploaded raw image to MinIO: ${objectName}`);

        // 3. สร้าง event และ publish ไป RabbitMQ
        const channel = await getChannel();
        const eventPayload = {
          object_name: objectName,
          bucket: MINIO_RAW_BUCKET,
          device_uid,
          recorded_at,
          trace_id: traceId,
          image_type: 'raw',
          metadata: parsed?.extra_metadata || {},
        };
        channel.publish(
          RABBITMQ_EXCHANGE,
          RAW_ROUTING_KEY,
          Buffer.from(JSON.stringify(eventPayload)),
          { persistent: true }
        );
        console.log(`[${traceId}] Published event ${RAW_ROUTING_KEY}`, {
          objectName,
          device_uid,
        });
      } catch (e) {
        console.error(`[${traceId}] Ingestion failed:`, e);
        // ที่นี่อาจเก็บลง dead-letter log หรือ retry queue ตาม policy
      }
    });
  }
}
