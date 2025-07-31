// src/services/authService.ts
import { Repository } from 'typeorm';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refreshToken.model';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import {
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRE_MINUTES,
  REFRESH_TOKEN_EXPIRE_DAYS,
} from '../configs/config';

export class AuthService {
  constructor(
    private userRepo: Repository<User>,
    private tokenRepo: Repository<RefreshToken>
  ) {}

  /**
   * สมัครสมาชิก
   */
  async signup(
    email: string,
    username: string,
    password: string
  ) {
    const existing = await this.userRepo.findOneBy({ username });
    if (existing) throw new Error('Username already exists');

    const passwordHash = await hashPassword(password);
    const user = this.userRepo.create({ email, username, password_hash: passwordHash });
    await this.userRepo.save(user);
    return { message: 'User created', userId: user.user_id };
  }

  /**
   * เข้าสู่ระบบ
   */
  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials');

    const accessToken = jwt.sign(
      { sub: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` }
    );

    const refreshValue = jwt.sign({ sub: user.user_id }, JWT_SECRET, {
      expiresIn: `${REFRESH_TOKEN_EXPIRE_DAYS}d`,
    });
    const token = this.tokenRepo.create({
      user,
      refresh_token: refreshValue,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 86400000),
    });
    await this.tokenRepo.save(token);

    return { accessToken, refreshToken: refreshValue, tokenType: 'bearer', userId: user.user_id };
  }

  /**
   * รีเฟรช Access Token
   */
  async refresh(oldToken: string) {
    const stored = await this.tokenRepo.findOne({
      where: { refresh_token: oldToken },
      relations: ['user'],
    });
    if (!stored) throw new Error('Invalid refresh token');
    if (stored.expires_at && stored.expires_at < new Date()) throw new Error('Expired refresh token');

    jwt.verify(oldToken, JWT_SECRET);
    const user = stored.user;

    // สร้าง Access ใหม่
    const accessToken = jwt.sign(
      { sub: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` }
    );

    return { accessToken, tokenType: 'bearer' };
  }

  /**
   * ลบ Refresh Token
   */
  async revoke(oldToken: string) {
    await this.tokenRepo.delete({ refresh_token: oldToken });
  }
}