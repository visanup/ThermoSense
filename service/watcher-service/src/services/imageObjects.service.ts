import { Repository } from 'typeorm';
import { AppDataSource } from '../utils/dataSource';
import {
  ImageObject,
  ImageType,
  ObjectStatus,
} from '../models/objectRecord.model';

export type { ImageType, ObjectStatus };

const repo: Repository<ImageObject> = AppDataSource.getRepository(ImageObject);

/**
 * Upsert (create or update) an ImageObject based on unique minioBucket + objectName.
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

  // Try find existing
  let existing = await repo.findOne({ where: { minioBucket, objectName } });
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

  // Create new
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

  try {
    return await repo.save(newObj);
  } catch (err: any) {
    // Handle duplicate insert race
    if (err.code === '23505') {
      existing = await repo.findOne({ where: { minioBucket, objectName } });
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
    }
    throw err;
  }
}

/**
 * Get an ImageObject by bucket and object name.
 */
export async function getImageObjectByBucketName(
  minioBucket: string,
  objectName: string
): Promise<ImageObject | null> {
  return repo.findOne({ where: { minioBucket, objectName } });
}

/**
 * Update the status of an ImageObject.
 */
export async function updateImageStatus(
  id: string,
  status: ObjectStatus
): Promise<void> {
  await repo.update(id, { status });
}

/**
 * List ImageObjects in 'pending' status, optionally filtered by imageType.
 */
export async function listPendingObjects(
  imageType?: ImageType
): Promise<ImageObject[]> {
  const where: any = { status: 'pending' };
  if (imageType) where.imageType = imageType;
  return repo.find({ where, order: { recordedAt: 'DESC' } });
}
