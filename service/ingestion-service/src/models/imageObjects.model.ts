// src/models/imageObjects.model.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Device } from './devices.model';

export type ImageType = 'raw' | 'processed';

@Entity({ schema: 'thermo', name: 'image_objects' })
@Unique('uq_minio_object', ['minio_bucket', 'object_name'])
@Index(['device', 'recorded_at'])
export class ImageObject {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @Column({ type: 'timestamptz' })
  recorded_at!: Date;

  @Column({ type: 'text' })
  minio_bucket!: string;

  @Column({ type: 'text' })
  object_name!: string;

  @Column({ type: 'text', nullable: true })
  object_version?: string;

  @Column({ type: 'text', nullable: true })
  checksum?: string;

  @Column({
    type: 'enum',
    enum: ['raw', 'processed'],
    default: 'raw',
  })
  image_type!: ImageType;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
