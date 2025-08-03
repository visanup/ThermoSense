// --- File: src/services/devices.service.ts ---
import { Repository, DeepPartial } from 'typeorm';
import { Device } from '../models/devices.model';
import { AppDataSource } from '../utils/dataSource';

export class DevicesService {
  private repo: Repository<Device>;

  constructor() {
    this.repo = AppDataSource.getRepository(Device);
  }

  async list(): Promise<Device[]> {
    return this.repo.find({ relations: ['temperature_readings'] });
  }

  async getById(id: number): Promise<Device | null> {
    return this.repo.findOne({ where: { id }, relations: ['temperature_readings'] });
  }

  async getByUID(device_uid: string): Promise<Device | null> {
    return this.repo.findOne({ where: { device_uid }, relations: ['temperature_readings'] });
  }

  async create(data: DeepPartial<Device>): Promise<Device> {
    const device = this.repo.create(data);
    return this.repo.save(device);
  }

  async update(id: number, update: DeepPartial<Device>): Promise<Device> {
    await this.repo.update(id, update as any);
    const updated = await this.getById(id);
    if (!updated) throw new Error('Device not found after update');
    return updated;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
