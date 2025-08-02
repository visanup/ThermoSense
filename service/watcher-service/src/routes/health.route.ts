// src/routes/health.route.ts
import { Router } from 'express';
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    service: 'ingestion-service',
  });
});

export default router;
