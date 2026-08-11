import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { name, phone, password } = req.body;

  if (!name || !password) {
    res.status(400).json({ code: 400, message: '姓名和密码不能为空' });
    return;
  }

  if (phone) {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) {
      res.status(409).json({ code: 409, message: '该手机号已注册' });
      return;
    }
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = uuid();

  db.prepare('INSERT INTO users (id, name, phone, password_hash) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    phone || null,
    passwordHash
  );

  const token = signToken(id, name);
  res.json({ code: 200, message: '注册成功', data: { token, user: { id, name, phone } } });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    res.status(400).json({ code: 400, message: '手机号和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as
    | {
        id: string;
        name: string;
        phone: string;
        password_hash: string;
      }
    | undefined;

  if (!user) {
    res.status(404).json({ code: 404, message: '账号不存在，请先注册' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ code: 401, message: '密码错误' });
    return;
  }

  const token = signToken(user.id, user.name);
  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: { id: user.id, name: user.name, phone: user.phone },
    },
  });
});

// GET /api/auth/profile
router.get('/profile', authMiddleware as any, (req: AuthRequest, res: Response) => {
  const user = db
    .prepare('SELECT id, name, phone, created_at FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) {
    res.status(404).json({ code: 404, message: '用户不存在' });
    return;
  }
  res.json({ code: 200, data: user });
});

// PUT /api/auth/profile (update name)
router.put('/profile', authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ code: 400, message: '姓名不能为空' });
    return;
  }
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId);
  res.json({ code: 200, message: '修改成功' });
});

export default router;
