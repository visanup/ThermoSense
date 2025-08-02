// src/models/temperatureReading.model.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  RelationId,
} from 'typeorm';
import { Device } from './devices.model';
import { ImageObject } from './objectRecord.model';

@Entity({ schema: 'thermo', name: 'temperature_readings' })
@Index('uq_device_time', ['deviceId', 'recorded_at'], { unique: true })
export class TemperatureReading {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @RelationId((reading: TemperatureReading) => reading.device)
  deviceId!: number;

  @Column({ type: 'timestamptz' })
  recorded_at!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 3 })
  temperature!: string;

  @ManyToOne(() => ImageObject, { nullable: true })
  @JoinColumn({ name: 'raw_image_id' })
  raw_image?: ImageObject;

  @ManyToOne(() => ImageObject, { nullable: true })
  @JoinColumn({ name: 'processed_image_id' })
  processed_image?: ImageObject;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
