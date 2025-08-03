// service/watcher-service/src/services/watchRawBucket.service.ts

import { minioClient } from '../utils/minioClient';
import { getChannel } from '../utils/rabbitmqClient';
import {
  RABBITMQ_EXCHANGE,
  RAW_ROUTING_KEY,
  PROCESSED_ROUTING_KEY,
  MINIO_RAW_BUCKET,
  MINIO_PROCESSED_BUCKET,
} from '../configs/config';
import { WatcherEvent } from '../types/eventMessage';
import {
  upsertImageObject,
  ImageType,
  ObjectStatus,
} from './imageObjects.service';
import { getOrCreateDeviceByUID } from '../services/device.service';

/**
 * แปลงจาก objectKey เป็น device_uid
 * ปรับ logic ให้ตรงกับรูปแบบชื่อไฟล์จริงของคุณ
 * ตัวอย่าง: "mg400-1.jpg" -> "mg400"
 */
function parseDeviceUIDFromObjectKey(objectKey: string): string {
  const base = objectKey.split('/').pop() || objectKey; // ถ้ามี path
  const parts = base.split('-');
  return parts[0];
}

/**
 * ส่ง event ไปยัง RabbitMQ
 */
async function publishEvent(routingKey: string, event: WatcherEvent) {
  try {
    const channel = await getChannel();
    channel.publish(RABBITMQ_EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    console.log(`✅ Published to ${routingKey}:`, event.objectKey);
  } catch (err) {
    console.error('❌ Failed to publish event', err);
  }
}

/**
 * สร้าง listener สำหรับ bucket ใดๆ
 */
function listenBucket(
  bucket: string,
  routingKey: string,
  imageType: ImageType,
  desiredStatus: ObjectStatus
) {
  const listener = minioClient.listenBucketNotification(bucket, '', '', ['s3:ObjectCreated:*']);

  listener.on('notification', async (record: any) => {
    const objectKey = record.s3.object.key;
    console.log(`📥 Detected new object in "${bucket}":`, objectKey);

    try {
      // 1. หา/สร้าง device จาก object key
      const deviceUID = parseDeviceUIDFromObjectKey(objectKey);
      const device = await getOrCreateDeviceByUID(deviceUID);
      const deviceId = device.id;

      // 2. recordedAt — ปรับให้ดึงจริงจากชื่อไฟล์หรือ metadata ถ้ามี
      const recordedAt = new Date();

      // 3. Upsert image object
      const imageObj = await upsertImageObject({
        deviceId,
        recordedAt,
        minioBucket: bucket,
        objectName: objectKey,
        imageType,
        status: desiredStatus,
        metadata: {},
      });

      // 4. สร้าง event พร้อม context แล้ว publish
      const event: WatcherEvent = {
        bucket,
        objectKey,
        eventTime: new Date().toISOString(),
        metadata: {
          imageObjectId: imageObj.id,
          imageType: imageObj.imageType,
          status: imageObj.status,
          deviceId,
          recordedAt: imageObj.recordedAt,
        },
      };

      await publishEvent(routingKey, event);
    } catch (e) {
      console.error('❌ Error upserting image object or publishing event:', e);
    }
  });

  listener.on('error', (err: any) => {
    console.error(
      `⚠️ MinIO listener error for bucket ${bucket} (type=${imageType}):`,
      err
    );
  });

  console.log(
    `👀 Watching MinIO bucket "${bucket}" as "${imageType}" with routing key "${routingKey}" and default status "${desiredStatus}"`
  );
}

/**
 * entry point สร้าง watcher ทั้ง raw + processed
 */
export function watchRawAndProcessedBuckets() {
  // raw -> pending
  listenBucket(MINIO_RAW_BUCKET, RAW_ROUTING_KEY, 'raw', 'pending');
  // processed -> processing (หรือ 'completed' หาก workflow ถือว่าเสร็จ)
  listenBucket(MINIO_PROCESSED_BUCKET, PROCESSED_ROUTING_KEY, 'processed', 'processing');
}

