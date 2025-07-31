import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TemperatureReading } from './temperatureReading.model';

@Entity({ schema: 'thermo', name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  device_uid!: string;

  @Column({ type: 'text', nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  device_type?: string;

  @Column({ type: 'text', nullable: true })
  location?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  installed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => TemperatureReading, (tr) => tr.device)
  temperature_readings!: TemperatureReading[];
}
