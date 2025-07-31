// src/models/temperatureReading.model.ts
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

@Entity({ schema: 'thermo', name: 'temperature_readings' })
@Index(['device', 'recorded_at'])
export class TemperatureReading {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ManyToOne(() => Device, (d) => d.temperature_readings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @Column({ type: 'timestamptz' })
  recorded_at!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 3 })
  temperature!: string; // keep as string to preserve precision; convert in business logic if needed

  @Column({ type: 'bigint', nullable: true })
  raw_image_id?: number;

  @Column({ type: 'bigint', nullable: true })
  processed_image_id?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
