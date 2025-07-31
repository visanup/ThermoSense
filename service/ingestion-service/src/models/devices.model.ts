// services/economic-service/src/models/devices.model.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ImageObject } from './imageObjects.model';

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

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  installed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => ImageObject, (img) => img.device)
  image_objects!: ImageObject[];
}

