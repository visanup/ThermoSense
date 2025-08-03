// --- File: src/models/imageObject.model.ts ---
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Device } from './devices.model';

export enum ObjectStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum ImageType {
  Raw = 'raw',
  Processed = 'processed',
}

@Entity({ schema: 'thermo', name: 'image_objects' })
@Unique('uq_minio_object', ['minio_bucket', 'object_name'])
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

  @Column({ type: 'enum', enum: ImageType })
  image_type!: ImageType;

  @Column({ type: 'enum', enum: ObjectStatus, default: ObjectStatus.Pending })
  status!: ObjectStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}