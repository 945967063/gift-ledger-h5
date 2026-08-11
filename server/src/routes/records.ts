import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware as any);

// GET /api/records?page=1&pageSize=20&type=received|given&contactName=xx
router.get('/', (req: AuthRequest, res: Response) => {
  const { type, contactName, page = '1', pageSize = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);

  let sql = 'SELECT * FROM records WHERE user_id = ?';
  const params: any[] = [req.userId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (contactName) {
    sql += ' AND contact_name = ?';
    params.push(contactName);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), offset);

  const records = db.prepare(sql).all(...params);

  // Total count
  let countSql = 'SELECT COUNT(*) as total FROM records WHERE user_id = ?';
  const countParams: any[] = [req.userId];
  if (type) {
    countSql += ' AND type = ?';
    countParams.push(type);
  }
  if (contactName) {
    countSql += ' AND contact_name = ?';
    countParams.push(contactName);
  }
  const { total } = db.prepare(countSql).get(...countParams) as { total: number };

  res.json({ code: 200, data: { records, total, page: Number(page), pageSize: Number(pageSize) } });
});

// POST /api/records — 新增单条记录
router.post('/', (req: AuthRequest, res: Response) => {
  const {
    eventId,
    eventTitle,
    eventDate,
    eventType,
    type,
    contactName,
    contactRelation,
    amount,
    remark,
  } = req.body;

  if (!eventTitle || !amount || !type) {
    res.status(400).json({ code: 400, message: '事件名称、金额和类型不能为空' });
    return;
  }

  const id = uuid();
  let contactId: string | null = null;

  if (contactName) {
    const contact = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
      .get(req.userId, contactName) as any;
    if (contact) contactId = contact.id;
  }

  db.prepare(
    `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    eventId || null,
    eventTitle,
    eventDate || new Date().toISOString().slice(0, 10),
    eventType || 'other',
    type,
    contactId,
    contactName || '',
    contactRelation || '朋友',
    Number(amount),
    remark || null
  );

  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  res.json({ code: 200, message: '记录添加成功', data: record });
});

// DELETE /api/records/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const result = db
    .prepare('DELETE FROM records WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);

  if (result.changes === 0) {
    res.status(404).json({ code: 404, message: '记录不存在' });
    return;
  }
  res.json({ code: 200, message: '删除成功' });
});

export default router;
