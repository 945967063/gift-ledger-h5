import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  normalizeNullableString,
  normalizeOptionalString,
  normalizeString,
  RELATION_TYPES,
} from '../validation';

const router = Router();
router.use(authMiddleware as any);

router.get('/', (req: AuthRequest, res: Response) => {
  const contacts = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  res.json({ code: 200, data: contacts });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const name = normalizeString(req.body.name, 30);
  const relation = RELATION_TYPES.has(req.body.relation) ? req.body.relation : '朋友';
  const tag = normalizeNullableString(req.body.tag, 30);
  const phone = normalizeNullableString(req.body.phone, 30);
  const remark = normalizeNullableString(req.body.remark, 200);
  const avatarBg = normalizeNullableString(req.body.avatarBg, 30);

  if (!name) {
    res.status(400).json({ code: 400, message: '联系人姓名不能为空且不能超过 30 个字符' });
    return;
  }
  if ([tag, phone, remark, avatarBg].includes(undefined)) {
    res.status(400).json({ code: 400, message: '联系人信息格式不正确或长度超限' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
    .get(req.userId, name);
  if (existing) {
    res.status(409).json({ code: 409, message: '同名联系人已存在' });
    return;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO contacts (id, user_id, name, relation, tag, phone, remark, avatar_bg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, name, relation, tag, phone, remark, avatarBg);

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  res.status(201).json({ code: 201, message: '联系人添加成功', data: contact });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
    .get(id, req.userId) as { id: string; name: string } | undefined;

  if (!existing) {
    res.status(404).json({ code: 404, message: '联系人不存在' });
    return;
  }

  const assignments: string[] = [];
  const values: Array<string | null> = [];
  let updatedName: string | null = null;
  let updatedRelation: string | null = null;
  const addOptionalUpdate = (bodyKey: string, column: string, maxLength: number) => {
    if (!(bodyKey in req.body)) return true;
    const value = normalizeOptionalString(req.body[bodyKey], maxLength);
    if (value === undefined) return false;
    assignments.push(`${column} = ?`);
    values.push(value);
    return true;
  };

  if ('name' in req.body) {
    const name = normalizeString(req.body.name, 30);
    if (!name) {
      res.status(400).json({ code: 400, message: '联系人姓名不能为空且不能超过 30 个字符' });
      return;
    }
    const duplicate = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ? AND id != ?')
      .get(req.userId, name, id);
    if (duplicate) {
      res.status(409).json({ code: 409, message: '同名联系人已存在' });
      return;
    }
    assignments.push('name = ?');
    values.push(name);
    updatedName = name;
  }
  if ('relation' in req.body) {
    if (!RELATION_TYPES.has(req.body.relation)) {
      res.status(400).json({ code: 400, message: '联系人关系类型不合法' });
      return;
    }
    assignments.push('relation = ?');
    values.push(req.body.relation);
    updatedRelation = req.body.relation;
  }
  if (
    !addOptionalUpdate('tag', 'tag', 30) ||
    !addOptionalUpdate('phone', 'phone', 30) ||
    !addOptionalUpdate('remark', 'remark', 200) ||
    !addOptionalUpdate('avatarBg', 'avatar_bg', 30)
  ) {
    res.status(400).json({ code: 400, message: '联系人信息格式不正确或长度超限' });
    return;
  }
  if (!assignments.length) {
    res.status(400).json({ code: 400, message: '没有可更新的字段' });
    return;
  }

  const updateContact = db.transaction(() => {
    db.prepare(`UPDATE contacts SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`).run(
      ...values,
      id,
      req.userId
    );
    if (updatedName) {
      db.prepare('UPDATE records SET contact_name = ? WHERE contact_id = ? AND user_id = ?').run(
        updatedName,
        id,
        req.userId
      );
      db.prepare(
        `UPDATE events
         SET target_contact_name = ?
         WHERE user_id = ? AND id IN (
           SELECT event_id FROM records
           WHERE contact_id = ? AND user_id = ? AND event_id IS NOT NULL
         )`
      ).run(updatedName, req.userId, id, req.userId);
    }
    if (updatedRelation) {
      db.prepare(
        'UPDATE records SET contact_relation = ? WHERE contact_id = ? AND user_id = ?'
      ).run(updatedRelation, id, req.userId);
    }
  });
  updateContact();

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  res.json({ code: 200, message: '修改成功', data: updated });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const result = db
    .prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);

  if (result.changes === 0) {
    res.status(404).json({ code: 404, message: '联系人不存在' });
    return;
  }
  res.json({ code: 200, message: '删除成功' });
});

router.get('/:name/ledger', (req: AuthRequest, res: Response) => {
  const name = normalizeString(req.params.name, 30);
  if (!name) {
    res.status(400).json({ code: 400, message: '联系人姓名不合法' });
    return;
  }

  const contact = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? AND name = ?')
    .get(req.userId, name);
  const records = db
    .prepare(
      `SELECT * FROM records
       WHERE user_id = ? AND contact_name = ?
       ORDER BY event_date DESC, created_at DESC`
    )
    .all(req.userId, name) as { type: string; amount: number }[];

  const receivedList = records.filter((record) => record.type === 'received');
  const givenList = records.filter((record) => record.type === 'given');
  const totalReceived = receivedList.reduce((sum, record) => sum + Number(record.amount), 0);
  const totalGiven = givenList.reduce((sum, record) => sum + Number(record.amount), 0);
  const diff = totalReceived - totalGiven;
  let balanceBadge = '往来平衡';
  if (diff > 0) balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
  else if (diff < 0) balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;

  res.json({
    code: 200,
    data: {
      contact: contact || null,
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
