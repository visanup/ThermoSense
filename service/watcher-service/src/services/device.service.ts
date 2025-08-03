// service/watcher-service/src/services/device.service.ts

import { AppDataSource } from '../utils/dataSource';
import { Device } from '../models/devices.model';

/**
 * หา device ตาม device_uid หรือสร้างใหม่ถ้ายังไม่มี
 * ป้องกัน race condition ขั้นพื้นฐาน: ถ้าสร้างแล้วชนกัน (unique violation) จะ refetch
 */
export async function getOrCreateDeviceByUID(device_uid: string): Promise<Device> {
  const repo = AppDataSource.getRepository(Device);

  // พยายามหาอันที่มีอยู่ก่อน
  let device = await repo.findOne({ where: { device_uid } });
  if (device) {
    return device;
  }

  // ถ้ายังไม่มี ให้ลองสร้าง
  try {
    const newDevice = repo.create({ device_uid });
    device = await repo.save(newDevice);
    return device;
  } catch (err: any) {
    // ถ้า error เป็น unique violation แปลว่าใครซักคนสร้างพร้อมกัน ให้ refetch
    if (err.code === '23505') {
      const existing = await repo.findOne({ where: { device_uid } });
      if (existing) return existing;
    }
    // อื่นๆ โยนต่อ
    throw err;
  }
}

/**
 * หา device โดย device_uid โดยไม่สร้าง
 */
export async function getDeviceByUID(device_uid: string): Promise<Device | null> {
  const repo = AppDataSource.getRepository(Device);
  return repo.findOne({ where: { device_uid } });
}
