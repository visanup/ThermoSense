// services/auth-service/src/routes/index.ts
import { Router } from 'express';
import { createAuthRouter } from './authRoutes';

const router = Router();

router.use('/api/auth', createAuthRouter);

export default router;


