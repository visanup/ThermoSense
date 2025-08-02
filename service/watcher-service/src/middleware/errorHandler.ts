// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error, req: Request, res: Response, next: NextFunction
) {
  if (res.headersSent) return next(err);
  console.error('🚨 Unhandled error:', err);
  res.status((err as any).status || 500).json({ error: err.message });
}