// src/models/refreshToken.model.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.model';

@Entity({ schema: 'auth', name: 'user_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn({ name: 'token_id' })
  token_id!: number;

  @ManyToOne(() => User, user => user.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('text', { name: 'refresh_token', unique: true })
  refresh_token!: string;

  @Column({ type: 'timestamptz', name: 'issued_at', default: () => 'NOW()' })
  issued_at!: Date;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expires_at?: Date;
}

