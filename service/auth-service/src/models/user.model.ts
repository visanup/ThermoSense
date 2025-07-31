// src/models/user.model.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from './refreshToken.model';

@Entity({ schema: 'auth', name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  user_id!: number;

  @Column({ unique: true, name: 'username', length: 100 })
  username!: string;

  @Column('text', { name: 'password_hash' })
  password_hash!: string;

  @Column({ name: 'role', default: 'user', length: 50 })
  role!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at!: Date;

  @OneToMany(() => RefreshToken, token => token.user)
  tokens?: RefreshToken[];
}
