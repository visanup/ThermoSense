// src/models/objectRecord.model.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { Device } from './devices.model';

export type ImageType = 'raw' | 'processed';
export type ObjectStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity({ schema: 'thermo', name: 'image_objects' })
@Check(`image_type IN ('raw','processed')`)
@Index('idx_image_objects_device_time', ['deviceId', 'recordedAt'])
@Index('uq_minio_object', ['minioBucket', 'objectName'], { unique: true })
export class ImageObject {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'device_id', type: 'integer' })
  deviceId!: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device?: Device;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'minio_bucket', type: 'text' })
  minioBucket!: string;

  @Column({ name: 'object_name', type: 'text' })
  objectName!: string;

  @Column({ name: 'object_version', type: 'text', nullable: true })
  objectVersion?: string;

  @Column({ type: 'text', nullable: true })
  checksum?: string;

  @Column({
    name: 'image_type',
    type: 'text',
  })
  imageType!: ImageType;

  @Column({
    type: 'jsonb',
    default: () => "'{}'",
  })
  metadata!: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed'],
    enumName: 'object_status',
    default: 'pending',
  })
  status!: ObjectStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
