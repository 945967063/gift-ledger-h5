import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware as any);

// GET /api/contacts
router.get('/', (req: AuthRequest, res: Response) => {
  const contacts = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  res.json({ code: 200, data: contacts });
});

// POST /api/contacts
router.post('/', (req: AuthRequest, res: Response) => {
  const { name, relation, tag, phone, remark, avatarBg } = req.body;

  if (!name) {
    res.status(400).json({ code: 400, message: '联系人姓名不能为空' });
    return;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO contacts (id, user_id, name, relation, tag, phone, remark, avatar_bg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    name,
    relation || '朋友',
    tag || null,
    phone || null,
    remark || null,
    avatarBg || null
  );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  res.json({ code: 200, message: '联系人添加成功', data: contact });
});

// PUT /api/contacts/:id
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
    .get(id, req.userId);

  if (!existing) {
    res.status(404).json({ code: 404, message: '联系人不存在' });
    return;
  }

  const { name, relation, tag, phone, remark, avatarBg } = req.body;
  db.prepare(
    `UPDATE contacts SET
      name = COALESCE(?, name),
      relation = COALESCE(?, relation),
      tag = COALESCE(?, tag),
      phone = COALESCE(?, phone),
      remark = COALESCE(?, remark),
      avatar_bg = COALESCE(?, avatar_bg)
     WHERE id = ? AND user_id = ?`
  ).run(
    name || null,
    relation || null,
    tag || null,
    phone || null,
    remark || null,
    avatarBg || null,
    id,
    req.userId
  );

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  res.json({ code: 200, message: '修改成功', data: updated });
});

// DELETE /api/contacts/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const result = db
    .prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  if (result.changes === 0) {
    res.status(404).json({ code: 404, message: '联系人不存在' });
    return;
  }
  res.json({ code: 200, message: '删除成功' });
});

// GET /api/contacts/:name/ledger — 人情对账详情
router.get('/:name/ledger', (req: AuthRequest, res: Response) => {
  const { name } = req.params;

  const contact = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? AND name = ?')
    .get(req.userId, name);

  const records = db
    .prepare(
      `SELECT * FROM records
     WHERE user_id = ? AND contact_name = ?
     ORDER BY event_date DESC`
    )
    .all(req.userId, name);

  const receivedList = (records as any[]).filter((r) => r.type === 'received');
  const givenList = (records as any[]).filter((r) => r.type === 'given');

  const totalReceived = receivedList.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalGiven = givenList.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const diff = totalReceived - totalGiven;

  let balanceBadge = '往来平衡';
  if (diff > 0) balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
  else if (diff < 0) balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;

  res.json({
    code: 200,
    data: {
      contact,
      records,
      totalReceived,
      totalGiven,
      receivedCount: receivedList.length,
      givenCount: givenList.length,
      diff,
      balanceBadge,
    },
  });
});

export default router;
