// src/services/devices.service.ts
import { AppDataSource } from '../utils/dataSource';
import { Device } from '../models/devices.model';

export class DeviceService {
  private repo = AppDataSource.getRepository(Device);

  async create(payload: Partial<Device>): Promise<Device> {
    const device = this.repo.create(payload);
    return await this.repo.save(device);
  }

  async getById(id: number): Promise<Device | null> {
    return await this.repo.findOne({ where: { id } });
  }

  async getByUid(uid: string): Promise<Device | null> {
    return await this.repo.findOne({ where: { device_uid: uid } });
  }

  async list(limit = 50, offset = 0): Promise<Device[]> {
    return await this.repo.find({
      skip: offset,
      take: limit,
      order: { updated_at: 'DESC' },
    });
  }

  async update(id: number, updates: Partial<Device>): Promise<Device | null> {
    const device = await this.getById(id);
    if (!device) return null;
    Object.assign(device, updates);
    return await this.repo.save(device);
  }

  async delete(id: number): Promise<boolean> {
    const res = await this.repo.delete(id);
    return (res.affected ?? 0) > 0;
  }
}
