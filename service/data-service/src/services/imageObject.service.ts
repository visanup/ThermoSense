// --- File: src/services/imageObject.service.ts ---
import { Repository, DeepPartial } from 'typeorm';
import { ImageObject } from '../models/imageObject.model';
import { AppDataSource } from '../utils/dataSource';

export class ImageObjectService {
  private repo: Repository<ImageObject>;

  constructor() {
    this.repo = AppDataSource.getRepository(ImageObject);
  }

  async list(): Promise<ImageObject[]> {
    return this.repo.find({ relations: ['device'] });
  }

  async getById(id: number): Promise<ImageObject | null> {
    return this.repo.findOne({ where: { id }, relations: ['device'] });
  }

  async create(data: DeepPartial<ImageObject>): Promise<ImageObject> {
    const obj = this.repo.create(data);
    return this.repo.save(obj);
  }

  async update(id: number, update: DeepPartial<ImageObject>): Promise<ImageObject> {
    await this.repo.update(id, update as any);
    const updated = await this.getById(id);
    if (!updated) throw new Error('ImageObject not found after update');
    return updated;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}