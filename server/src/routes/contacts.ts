import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { writeOperationLog } from '../audit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createPaginationMeta, escapeLike, readPagination } from '../pagination';
import {
  normalizeNullableString,
  normalizeOptionalString,
  normalizeString,
  RELATION_TYPES,
} from '../validation';

const router = Router();
router.use(authMiddleware as any);

const contactSnapshot = (contact: Record<string, unknown>) => ({
  id: contact.id,
  name: contact.name,
  relation: contact.relation,
  tag: contact.tag,
  phone: contact.phone,
  remark: contact.remark,
});

router.get('/', (req: AuthRequest, res: Response) => {
  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 100 });
  const keyword =
    typeof req.query.keyword === 'string' ? req.query.keyword.trim().slice(0, 60) : '';
  const relation = typeof req.query.relation === 'string' ? req.query.relation.trim() : '';
  if (relation && !RELATION_TYPES.has(relation)) {
    res.status(400).json({ code: 400, message: '联系人关系筛选不合法' });
    return;
  }

  let whereSql = 'c.user_id = ?';
  const params: Array<string | number> = [req.userId!];
  if (relation) {
    whereSql += ' AND c.relation = ?';
    params.push(relation);
  }
  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereSql += ` AND (
      c.name LIKE ? ESCAPE '\\'
      OR c.relation LIKE ? ESCAPE '\\'
      OR c.tag LIKE ? ESCAPE '\\'
      OR c.phone LIKE ? ESCAPE '\\'
      OR c.remark LIKE ? ESCAPE '\\'
    )`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const contacts = db
    .prepare(
      `SELECT
         c.*,
         COALESCE(SUM(CASE WHEN r.type = 'received' THEN r.amount ELSE 0 END), 0) AS total_received,
         COALESCE(SUM(CASE WHEN r.type = 'given' THEN r.amount ELSE 0 END), 0) AS total_given,
         COALESCE(SUM(CASE WHEN r.type = 'received' THEN 1 ELSE 0 END), 0) AS received_count,
         COALESCE(SUM(CASE WHEN r.type = 'given' THEN 1 ELSE 0 END), 0) AS given_count
       FROM contacts c
       LEFT JOIN records r
         ON r.user_id = c.user_id
        AND (r.contact_id = c.id OR (r.contact_id IS NULL AND r.contact_name = c.name))
       WHERE ${whereSql}
       GROUP BY c.id
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pagination.pageSize, pagination.offset) as Array<Record<string, unknown>>;

  const countSql = `SELECT COUNT(*) AS total FROM contacts c WHERE ${whereSql}`;
  const { total } = db.prepare(countSql).get(...params) as { total: number };
  const items = contacts.map((contact) => {
    const totalReceived = Number(contact.total_received || 0);
    const totalGiven = Number(contact.total_given || 0);
    const diff = totalReceived - totalGiven;
    let balanceBadge = '往来平衡';
    if (diff > 0) balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
    else if (diff < 0) balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;
    return { ...contact, diff, balance_badge: balanceBadge };
  });

  res.json({
    code: 200,
    data: items,
    pagination: createPaginationMeta(pagination, total),
  });
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
  const createContact = db.transaction(() => {
    db.prepare(
      `INSERT INTO contacts (id, user_id, name, relation, tag, phone, remark, avatar_bg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.userId, name, relation, tag, phone, remark, avatarBg);
    const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    writeOperationLog({
      userId: req.userId!,
      action: 'contact_created',
      entityType: 'contact',
      summary: `新增联系人“${name}”`,
      details: { after: contactSnapshot(created) },
    });
  });
  createContact();

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
    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    writeOperationLog({
      userId: req.userId!,
      action: 'contact_updated',
      entityType: 'contact',
      summary: `修改联系人“${String(updated.name)}”`,
      details: {
        before: contactSnapshot(existing as unknown as Record<string, unknown>),
        after: contactSnapshot(updated),
      },
    });
  });
  updateContact();

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  res.json({ code: 200, message: '修改成功', data: updated });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '联系人不存在' });
    return;
  }

  const deleteContact = db.transaction(() => {
    db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    writeOperationLog({
      userId: req.userId!,
      action: 'contact_deleted',
      entityType: 'contact',
      summary: `删除联系人“${String(existing.name)}”`,
      details: { before: contactSnapshot(existing) },
    });
  });
  deleteContact();
  res.json({ code: 200, message: '删除成功' });
});

router.get('/:identifier/ledger', (req: AuthRequest, res: Response) => {
  const identifier = normalizeString(req.params.identifier, 64);
  if (!identifier) {
    res.status(400).json({ code: 400, message: '联系人标识不合法' });
    return;
  }

  const contact = db
    .prepare(
      `SELECT * FROM contacts
       WHERE user_id = ? AND (id = ? OR name = ?)
       ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
       LIMIT 1`
    )
    .get(req.userId, identifier, identifier, identifier) as Record<string, unknown> | undefined;
  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 100 });
  const recordParams: Array<string | number> = [req.userId!];
  let recordWhereSql: string;
  if (contact) {
    recordWhereSql = '(contact_id = ? OR (contact_id IS NULL AND contact_name = ?))';
    recordParams.push(String(contact.id), String(contact.name));
  } else {
    recordWhereSql = 'contact_name = ?';
    recordParams.push(identifier);
  }

  const records = db
    .prepare(
      `SELECT * FROM records
       WHERE user_id = ? AND ${recordWhereSql}
       ORDER BY event_date DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...recordParams, pagination.pageSize, pagination.offset);
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS totalReceived,
         COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS totalGiven,
         COALESCE(SUM(CASE WHEN type = 'received' THEN 1 ELSE 0 END), 0) AS receivedCount,
         COALESCE(SUM(CASE WHEN type = 'given' THEN 1 ELSE 0 END), 0) AS givenCount
       FROM records
       WHERE user_id = ? AND ${recordWhereSql}`
    )
    .get(...recordParams) as {
    total: number;
    totalReceived: number;
    totalGiven: number;
    receivedCount: number;
    givenCount: number;
  };

  const totalReceived = Number(totals.totalReceived || 0);
  const totalGiven = Number(totals.totalGiven || 0);
  const diff = totalReceived - totalGiven;
  let balanceBadge = '往来平衡';
  if (diff > 0) balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
  else if (diff < 0) balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;
  const pageMeta = createPaginationMeta(pagination, totals.total);

  res.json({
    code: 200,
    data: {
      contact: contact || null,
      records,
      totalReceived,
      totalGiven,
      receivedCount: totals.receivedCount,
      givenCount: totals.givenCount,
      diff,
      balanceBadge,
      pagination: pageMeta,
    },
    pagination: pageMeta,
  });
});

export default router;
