// src/services/imageObjects.service.ts
import { AppDataSource } from '../utils/dataSource';
import { ImageObject } from '../models/imageObjects.model';
import { Device } from '../models/devices.model';

export interface CreateImageObjectPayload {
  device_uid: string;
  recorded_at: Date;
  minio_bucket: string;
  object_name: string;
  object_version?: string;
  checksum?: string;
  image_type: 'raw' | 'processed';
  metadata?: Record<string, any>;
}

export interface ListImageObjectOptions {
  device_uid?: string;
  image_type?: 'raw' | 'processed';
  recorded_from?: Date;
  recorded_to?: Date;
  limit?: number;
  offset?: number;
}

export interface UpdateImageObjectPayload {
  device_uid?: string;
  recorded_at?: Date;
  minio_bucket?: string;
  object_name?: string;
  object_version?: string;
  checksum?: string;
  image_type?: 'raw' | 'processed';
  metadata?: Record<string, any>;
}

export class ImageObjectsService {
  private repo = AppDataSource.getRepository(ImageObject);
  private deviceRepo = AppDataSource.getRepository(Device);

  async create(payload: CreateImageObjectPayload): Promise<ImageObject> {
    const device = await this.deviceRepo.findOne({
      where: { device_uid: payload.device_uid },
    });
    if (!device) {
      throw new Error(`Device with uid=${payload.device_uid} not found`);
    }

    const imageObj = this.repo.create({
      device,
      recorded_at: payload.recorded_at,
      minio_bucket: payload.minio_bucket,
      object_name: payload.object_name,
      object_version: payload.object_version,
      checksum: payload.checksum,
      image_type: payload.image_type,
      metadata: payload.metadata ?? {},
    });

    return await this.repo.save(imageObj);
  }

  async getById(id: number): Promise<ImageObject | null> {
    return await this.repo.findOne({
      where: { id },
      relations: ['device'],
    });
  }

  async list(opts: ListImageObjectOptions = {}): Promise<ImageObject[]> {
    const {
      device_uid,
      image_type,
      recorded_from,
      recorded_to,
      limit = 50,
      offset = 0,
    } = opts;

    const qb = this.repo
      .createQueryBuilder('img')
      .leftJoinAndSelect('img.device', 'device')
      .orderBy('img.recorded_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (device_uid) {
      qb.andWhere('device.device_uid = :uid', { uid: device_uid });
    }
    if (image_type) {
      qb.andWhere('img.image_type = :it', { it: image_type });
    }
    if (recorded_from && recorded_to) {
      qb.andWhere('img.recorded_at BETWEEN :from AND :to', {
        from: recorded_from.toISOString(),
        to: recorded_to.toISOString(),
      });
    } else if (recorded_from) {
      qb.andWhere('img.recorded_at >= :from', {
        from: recorded_from.toISOString(),
      });
    } else if (recorded_to) {
      qb.andWhere('img.recorded_at <= :to', {
        to: recorded_to.toISOString(),
      });
    }

    return await qb.getMany();
  }

  async update(id: number, updates: UpdateImageObjectPayload): Promise<ImageObject | null> {
    const imageObj = await this.getById(id);
    if (!imageObj) return null;

    if (updates.device_uid) {
      const device = await this.deviceRepo.findOne({ where: { device_uid: updates.device_uid } });
      if (!device) throw new Error(`Device with uid=${updates.device_uid} not found`);
      imageObj.device = device;
    }

    if (updates.recorded_at !== undefined) imageObj.recorded_at = updates.recorded_at;
    if (updates.minio_bucket !== undefined) imageObj.minio_bucket = updates.minio_bucket;
    if (updates.object_name !== undefined) imageObj.object_name = updates.object_name;
    if (updates.object_version !== undefined) imageObj.object_version = updates.object_version;
    if (updates.checksum !== undefined) imageObj.checksum = updates.checksum;
    if (updates.image_type !== undefined) imageObj.image_type = updates.image_type;
    if (updates.metadata !== undefined) imageObj.metadata = updates.metadata;

    return await this.repo.save(imageObj);
  }

  async delete(id: number): Promise<boolean> {
    const res = await this.repo.delete(id);
    return (res.affected ?? 0) > 0;
  }
}
