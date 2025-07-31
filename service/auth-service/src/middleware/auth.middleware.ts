// services/auth-service/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { VerifyErrors, JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET, ALGORITHM } from '../configs/config';

export interface AuthRequest extends Request {
  user?: JwtPayload | string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res
      .status(401)
      .json({ message: 'Malformed authorization header. Expected Bearer <token>' });
  }

  jwt.verify(
    token,
    JWT_SECRET,
    { algorithms: [ALGORITHM as jwt.Algorithm] },
    (err: VerifyErrors | null, payload: JwtPayload | string | undefined) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }
      req.user = payload!;
      next();
    }
  );
};

