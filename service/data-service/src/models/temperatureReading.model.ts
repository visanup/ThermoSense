// --- File: src/models/temperatureReading.model.ts ---
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Device } from './devices.model';
import { ImageObject } from './imageObject.model';

@Entity({ schema: 'thermo', name: 'temperature_readings' })
@Index(['device', 'recorded_at'], { unique: true })
export class TemperatureReading {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Device, (d) => d.temperature_readings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @Column({ type: 'timestamptz' })
  recorded_at!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 3 })
  temperature!: string; // stored as string to preserve precision

  @ManyToOne(() => ImageObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'raw_image_id' })
  raw_image?: ImageObject;

  @ManyToOne(() => ImageObject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processed_image_id' })
  processed_image?: ImageObject;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}