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
} from 'typeorm';
import { Device } from './devices.model';
import { ImageObject } from './imageObjects.model';

@Entity({ schema: 'thermo', name: 'temperature_readings' })
@Index(['device', 'recorded_at'])
export class TemperatureReading {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  // เอา inverse side (d => d.temperature_readings) ออก
  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

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

  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
