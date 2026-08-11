import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gift_ledger_secret_key_2024';

export interface AuthRequest extends Request {
  userId?: string;
  userName?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ code: 401, message: '未登录，请先登录' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; userName: string };
    req.userId = payload.userId;
    req.userName = payload.userName;
    next();
  } catch {
    res.status(401).json({ code: 401, message: 'Token 已过期，请重新登录' });
  }
};

export const signToken = (userId: string, userName: string): string => {
  return jwt.sign({ userId, userName }, JWT_SECRET, { expiresIn: '30d' });
};
