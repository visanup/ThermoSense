// service/watcher-service/src/services/imageObjects.service.ts

import { Repository } from 'typeorm';
import { AppDataSource } from '../utils/dataSource';
import {
  ImageObject,
  ImageType as ImageTypeModel,
  ObjectStatus as ObjectStatusModel,
} from '../models/objectRecord.model';

// re-export types เพื่อให้ไฟล์อื่น import ได้ตรงนี้
export type ImageType = ImageTypeModel;
export type ObjectStatus = ObjectStatusModel;

const repo: Repository<ImageObject> = AppDataSource.getRepository(ImageObject);

/**
 * Upsert image object (create or update) based on bucket + objectName uniqueness.
 */
export async function upsertImageObject(params: {
  deviceId: number;
  recordedAt: Date;
  minioBucket: string;
  objectName: string;
  objectVersion?: string;
  checksum?: string;
  imageType: ImageType;
  metadata?: Record<string, any>;
  status?: ObjectStatus;
}): Promise<ImageObject> {
  const {
    deviceId,
    recordedAt,
    minioBucket,
    objectName,
    objectVersion,
    checksum,
    imageType,
    metadata = {},
    status = 'pending',
  } = params;

  let existing = await repo.findOne({
    where: { minioBucket, objectName },
  });

  if (existing) {
    existing.deviceId = deviceId;
    existing.recordedAt = recordedAt;
    existing.objectVersion = objectVersion;
    existing.checksum = checksum;
    existing.imageType = imageType;
    existing.metadata = { ...existing.metadata, ...metadata };
    existing.status = status;
    return repo.save(existing);
  }

  const newObj = repo.create({
    deviceId,
    recordedAt,
    minioBucket,
    objectName,
    objectVersion,
    checksum,
    imageType,
    metadata,
    status,
  });
  return repo.save(newObj);
}

/**
 * Query helpers
 */
export async function getImageObjectByBucketName(
  minioBucket: string,
  objectName: string
): Promise<ImageObject | null> {
  return repo.findOne({
    where: { minioBucket, objectName },
  });
}

export async function updateImageStatus(id: string, status: ObjectStatus): Promise<void> {
  await repo.update(id, { status });
}

export async function listPendingObjects(imageType?: ImageType): Promise<ImageObject[]> {
  const where: any = { status: 'pending' as ObjectStatus };
  if (imageType) where.imageType = imageType;
  return repo.find({ where, order: { recordedAt: 'DESC' } });
}
