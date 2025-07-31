// src/services/temperatureReading.service.ts
import { AppDataSource } from '../utils/dataSource';
import { TemperatureReading } from '../models/temperatureReading.model';
import { Device } from '../models/devices.model';

interface CreateReadingPayload {
  device_uid: string;
  recorded_at: Date;
  temperature: string;
  raw_image_id?: number;
  processed_image_id?: number;
}

export class TemperatureReadingService {
  private repo = AppDataSource.getRepository(TemperatureReading);
  private deviceRepo = AppDataSource.getRepository(Device);

  async create(payload: CreateReadingPayload): Promise<TemperatureReading> {
    const device = await this.deviceRepo.findOne({ where: { device_uid: payload.device_uid } });
    if (!device) throw new Error('device not found');

    // สร้างและเซฟในขั้นตอนเดียว (ไม่ต้องใช้ repo.create แยกก็ได้)
    const tr = await this.repo.save({
      device: device,
      recorded_at: payload.recorded_at,
      temperature: payload.temperature,
      raw_image_id: payload.raw_image_id,
      processed_image_id: payload.processed_image_id,
    } as Partial<TemperatureReading>); // casting ระดับเบาๆ เพื่อให้ TypeORM รับได้

    return tr;
  }

  async getById(id: number): Promise<TemperatureReading | null> {
    return await this.repo.findOne({
      where: { id },
      relations: ['device'],
    });
  }

  async list(
    device_uid?: string,
    limit = 50,
    offset = 0
  ): Promise<TemperatureReading[]> {
    const qb = this.repo
      .createQueryBuilder('tr')
      .leftJoinAndSelect('tr.device', 'device')
      .orderBy('tr.recorded_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (device_uid) {
      qb.andWhere('device.device_uid = :uid', { uid: device_uid });
    }

    return await qb.getMany();
  }

  async update(id: number, updates: Partial<TemperatureReading>): Promise<TemperatureReading | null> {
    const tr = await this.getById(id);
    if (!tr) return null;
    Object.assign(tr, updates);
    return await this.repo.save(tr);
  }

  async delete(id: number): Promise<boolean> {
    const res = await this.repo.delete(id);
    return (res.affected ?? 0) > 0;
  }
}


