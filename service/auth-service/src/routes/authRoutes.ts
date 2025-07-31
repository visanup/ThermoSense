// src/services/auth-service/src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/authService';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refreshToken.model';
import { JWT_SECRET } from '../configs/config';

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
export function createAuthRouter(dataSource: DataSource) {
  const router = Router();
  const userRepo = dataSource.getRepository(User);
  const tokenRepo = dataSource.getRepository(RefreshToken);
  const authService = new AuthService(userRepo, tokenRepo);

  /**
   * @swagger
   * /api/auth/signup:
   *   post:
   *     summary: สมัครสมาชิกผู้ใช้ใหม่
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - username
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       201:
   *         description: สมัครสำเร็จ พร้อมข้อมูลผู้ใช้
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 userId:
   *                   type: integer
   */
  router.post('/signup', async (req: Request, res: Response) => {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Email, username and password are required' });
    }
    try {
      const result = await authService.signup(email, username, password);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: เข้าสู่ระบบ
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: เข้าสู่ระบบสำเร็จ พร้อม access/refresh token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken:
   *                   type: string
   *                 refreshToken:
   *                   type: string
   *                 tokenType:
   *                   type: string
   *                 userId:
   *                   type: integer
   *       401:
   *         description: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
   */
  router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
      const result = await authService.login(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ message: err.message });
    }
  });

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: แลก refresh token เป็น access token ใหม่
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: สำเร็จ ได้ access และ refresh token ใหม่
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken:
   *                   type: string
   *                 refreshToken:
   *                   type: string
   *       401:
   *         description: Refresh token ไม่ถูกต้องหรือหมดอายุ
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    try {
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ message: err.message });
    }
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout user and revoke refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       204:
   *         description: Logout successful, token revoked
   *       400:
   *         description: Refresh token is required
   *       500:
   *         description: Failed to revoke token
   */
  router.post('/logout', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    try {
      await authService.revoke(refreshToken);
      res.sendStatus(204);
    } catch {
      res.status(500).json({ message: 'Failed to revoke token' });
    }
  });

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: ดึงข้อมูลโปรไฟล์ผู้ใช้งานปัจจุบัน
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: ข้อมูลผู้ใช้งาน
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 userId:
   *                   type: integer
   *                 username:
   *                   type: string
   *                 email:
   *                   type: string
   *                 role:
   *                   type: string
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *       401:
   *         description: ไม่มีหรือ token ไม่ถูกต้อง
   *       404:
   *         description: ไม่พบผู้ใช้
   *       500:
   *         description: Could not load user profile
   */
  router.get('/me', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }
    try {
      const user = await userRepo.findOne({
        where: { user_id: userId },
        select: ['user_id', 'username', 'email', 'role', 'created_at'],
      });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      });
    } catch {
      res.status(500).json({ message: 'Could not load user profile' });
    }
  });

  return router;
}