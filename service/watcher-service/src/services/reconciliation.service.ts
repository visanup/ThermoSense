import { AppDataSource } from '../utils/dataSource';
import { ImageObject } from '../models/objectRecord.model';
import { Repository, MoreThan } from 'typeorm';
import { minioClient } from '../utils/minioClient';
import {
  getChannel,
} from '../utils/rabbitmqClient';
import {
  RABBITMQ_EXCHANGE,
  RAW_ROUTING_KEY,
  PROCESSED_ROUTING_KEY,
} from '../configs/config';

const repo: Repository<ImageObject> = AppDataSource.getRepository(ImageObject);

// ค่า default (ปรับจาก env ได้)
const PENDING_THRESHOLD_MS = Number(process.env.RECONCILE_PENDING_THRESHOLD_MS || 5 * 60 * 1000); // 5 นาที
const PROCESSING_THRESHOLD_MS = Number(process.env.RECONCILE_PROCESSING_THRESHOLD_MS || 10 * 60 * 1000); // 10 นาที
const INTERVAL_MS = Number(process.env.RECONCILE_INTERVAL_MS || 60 * 1000); // ทุก 1 นาที

interface ReconcileEventPayload {
  bucket: string;
  objectKey: string;
  eventTime: string;
  metadata?: Record<string, any>;
}

async function publishReconcileEvent(routingKey: string, payload: ReconcileEventPayload) {
  try {
    const channel = await getChannel();
    channel.publish(
      RABBITMQ_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    console.log(`[reconcile] republished event (${routingKey}) for ${payload.objectKey}`);
  } catch (err) {
    console.error('[reconcile] failed to republish event', err);
  }
}

/**
 * ตรวจสอบ image_objects ที่ค้างในสถานะ pending/processing เกิน threshold แล้ว reconcile:
 *  - ถ้ายังอยู่ใน MinIO: รี-ส่ง event ไป RabbitMQ
 *  - ถ้าไฟล์หาย: อัปเดต status เป็น 'failed'
 */
export async function runReconciliationCycle() {
  const now = Date.now();

  try {
    // 1. pending เก่าเกิน threshold
    const pendingCutoff = new Date(now - PENDING_THRESHOLD_MS);
    const stuckPending = await repo.find({
      where: {
        status: 'pending',
        recordedAt: MoreThan(new Date(0)), // dummy เพื่อให้ ts ไม่ complain; condition below uses updatedAt
        // we'll filter by updated_at manually because TypeORM partial filtering for time diffs is verbose
      },
    });

    // 2. processing เก่าเกิน threshold
    const processingCutoff = new Date(now - PROCESSING_THRESHOLD_MS);
    const stuckProcessing = await repo.find({
      where: {
        status: 'processing',
      },
    });

    // filter by updated_at manually
    const reallyStuckPending = stuckPending.filter((r) => {
      return r.updatedAt.getTime() < now - PENDING_THRESHOLD_MS;
    });
    const reallyStuckProcessing = stuckProcessing.filter((r) => {
      return r.updatedAt.getTime() < now - PROCESSING_THRESHOLD_MS;
    });

    // Reconcile pending
    for (const img of reallyStuckPending) {
      const objectKey = img.objectName;
      const bucket = img.minioBucket;
      try {
        // เช็กว่ามีอยู่จริงใน MinIO
        await minioClient.statObject(bucket, objectKey);
        // ถ้ามี: รี-publish raw.created event
        await publishReconcileEvent(RAW_ROUTING_KEY, {
          bucket,
          objectKey,
          eventTime: new Date().toISOString(),
          metadata: {
            imageObjectId: img.id,
            status: img.status,
          },
        });
      } catch (err: any) {
        // ไม่มีใน MinIO -> mark failed
        console.warn(`[reconcile] pending object missing in MinIO, marking failed: ${bucket}/${objectKey}`);
        img.status = 'failed';
        await repo.save(img);
      }
    }

    // Reconcile processing
    for (const img of reallyStuckProcessing) {
      const objectKey = img.objectName;
      const bucket = img.minioBucket;
      try {
        await minioClient.statObject(bucket, objectKey);
        // ถ้ายังอยู่: รี-publish processed.created event
        await publishReconcileEvent(PROCESSED_ROUTING_KEY, {
          bucket,
          objectKey,
          eventTime: new Date().toISOString(),
          metadata: {
            imageObjectId: img.id,
            status: img.status,
          },
        });
      } catch (err: any) {
        console.warn(`[reconcile] processing object missing in MinIO, marking failed: ${bucket}/${objectKey}`);
        img.status = 'failed';
        await repo.save(img);
      }
    }
  } catch (e) {
    console.error('[reconcile] error during reconciliation cycle:', e);
  }
}

/**
 * เริ่ม scheduler แบบง่าย
 */
export function startReconciliationLoop() {
  console.log(`[reconcile] starting reconciliation loop every ${INTERVAL_MS}ms`);
  // ทันทีรอบแรก
  runReconciliationCycle().catch((e) => {
    console.error('[reconcile] initial run failed:', e);
  });
  setInterval(() => {
    runReconciliationCycle().catch((e) => {
      console.error('[reconcile] periodic run failed:', e);
    });
  }, INTERVAL_MS);
}
