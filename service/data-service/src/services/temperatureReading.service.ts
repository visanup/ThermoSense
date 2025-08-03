// src/services/temperatureReading.service.ts
import { Repository, DeepPartial } from 'typeorm';
import { TemperatureReading } from '../models/temperatureReading.model';
import { AppDataSource } from '../utils/dataSource';
import { ImageObject } from '../models/imageObject.model';
import { Device } from '../models/devices.model';

export class TemperatureReadingService {
  private repo: Repository<TemperatureReading>;
  private imageRepo = AppDataSource.getRepository(ImageObject);
  private deviceRepo = AppDataSource.getRepository(Device);

  constructor() {
    this.repo = AppDataSource.getRepository(TemperatureReading);
  }

  async list(): Promise<TemperatureReading[]> {
    return this.repo.find({ relations: ['device', 'raw_image', 'processed_image'] });
  }

  async getById(id: number): Promise<TemperatureReading | null> {
    return this.repo.findOne({ where: { id }, relations: ['device', 'raw_image', 'processed_image'] });
  }

  async create(data: DeepPartial<TemperatureReading>): Promise<TemperatureReading> {
    // Resolve device relation if passed as device_id
    if ((data as any).device_id) {
      const device = await this.deviceRepo.findOne({ where: { id: (data as any).device_id } });
      if (!device) throw new Error('Device not found');
      (data as any).device = device;
      delete (data as any).device_id;
    }

    // Resolve raw_image relation
    if ((data as any).raw_image_id) {
      const raw = await this.imageRepo.findOne({ where: { id: (data as any).raw_image_id } });
      if (!raw) throw new Error('Raw image not found');
      (data as any).raw_image = raw;
      delete (data as any).raw_image_id;
    }

    // Resolve processed_image relation
    if ((data as any).processed_image_id) {
      const proc = await this.imageRepo.findOne({ where: { id: (data as any).processed_image_id } });
      if (!proc) throw new Error('Processed image not found');
      (data as any).processed_image = proc;
      delete (data as any).processed_image_id;
    }

    // Create and ensure it's a single entity, not array
    const readingRaw = this.repo.create(data as any);
    if (Array.isArray(readingRaw)) {
      throw new Error('Expected single TemperatureReading, got array');
    }
    const reading = readingRaw as TemperatureReading;

    return this.repo.save(reading);
  }

  async update(id: number, update: DeepPartial<TemperatureReading>): Promise<TemperatureReading> {
    await this.repo.update(id, update as any);
    const updated = await this.getById(id);
    if (!updated) throw new Error('TemperatureReading not found after update');
    return updated;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
