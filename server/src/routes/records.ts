import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { recalculateEvent, recordSnapshot, writeOperationLog } from '../audit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createPaginationMeta, escapeLike, readPagination } from '../pagination';
import {
  EVENT_TYPES,
  normalizeAmount,
  normalizeDate,
  normalizeNullableString,
  normalizeString,
  PAYMENT_METHODS,
  RECORD_TYPES,
  RELATION_TYPES,
} from '../validation';

const router = Router();
router.use(authMiddleware as any);

router.get('/', (req: AuthRequest, res: Response) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const contactName =
    typeof req.query.contactName === 'string'
      ? normalizeString(req.query.contactName, 30)
      : undefined;
  const eventId =
    typeof req.query.eventId === 'string' ? normalizeString(req.query.eventId, 64) : undefined;
  const keyword =
    typeof req.query.keyword === 'string' ? req.query.keyword.trim().slice(0, 60) : '';
  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 500 });

  if (type && !RECORD_TYPES.has(type)) {
    res.status(400).json({ code: 400, message: '收送礼类型不合法' });
    return;
  }
  if (req.query.contactName !== undefined && !contactName) {
    res.status(400).json({ code: 400, message: '联系人姓名不合法' });
    return;
  }
  if (req.query.eventId !== undefined && !eventId) {
    res.status(400).json({ code: 400, message: '事件标识不合法' });
    return;
  }

  let sql = 'SELECT * FROM records WHERE user_id = ?';
  const params: Array<string | number> = [req.userId!];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (contactName) {
    sql += ' AND contact_name = ?';
    params.push(contactName);
  }
  if (eventId) {
    sql += ' AND event_id = ?';
    params.push(eventId);
  }
  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    sql += ` AND (
      event_title LIKE ? ESCAPE '\\'
      OR contact_name LIKE ? ESCAPE '\\'
      OR remark LIKE ? ESCAPE '\\'
    )`;
    params.push(pattern, pattern, pattern);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(pagination.pageSize, pagination.offset);
  const records = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as total FROM records WHERE user_id = ?';
  const countParams: Array<string | number> = [req.userId!];
  if (type) {
    countSql += ' AND type = ?';
    countParams.push(type);
  }
  if (contactName) {
    countSql += ' AND contact_name = ?';
    countParams.push(contactName);
  }
  if (eventId) {
    countSql += ' AND event_id = ?';
    countParams.push(eventId);
  }
  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    countSql += ` AND (
      event_title LIKE ? ESCAPE '\\'
      OR contact_name LIKE ? ESCAPE '\\'
      OR remark LIKE ? ESCAPE '\\'
    )`;
    countParams.push(pattern, pattern, pattern);
  }
  const { total } = db.prepare(countSql).get(...countParams) as { total: number };
  const pageMeta = createPaginationMeta(pagination, total);

  res.json({
    code: 200,
    data: { records, items: records, ...pageMeta },
    pagination: pageMeta,
  });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const recordType = RECORD_TYPES.has(req.body.type) ? req.body.type : null;
  const contactName = normalizeString(req.body.contactName, 30);
  const contactRelation = RELATION_TYPES.has(req.body.contactRelation)
    ? req.body.contactRelation
    : '朋友';
  const amount = normalizeAmount(req.body.amount);
  const paymentMethod = PAYMENT_METHODS.has(req.body.paymentMethod)
    ? req.body.paymentMethod
    : 'cash';
  const customPaymentMethod = normalizeNullableString(req.body.customPaymentMethod, 20);
  const remark = normalizeNullableString(req.body.remark, 200);

  if (!recordType || !contactName || amount === null) {
    res.status(400).json({ code: 400, message: '请填写有效的联系人、金额和收送礼类型' });
    return;
  }
  if (
    customPaymentMethod === undefined ||
    remark === undefined ||
    (paymentMethod === 'custom' && !customPaymentMethod)
  ) {
    res.status(400).json({ code: 400, message: '请填写有效的支付方式和备注' });
    return;
  }

  let eventId: string | null = null;
  let eventTitle: string;
  let eventDate: string;
  let eventType: string;
  if (req.body.eventId) {
    const event = db
      .prepare(
        'SELECT id, title, date, type, is_hosted_by_me FROM events WHERE id = ? AND user_id = ?'
      )
      .get(req.body.eventId, req.userId) as
      | { id: string; title: string; date: string; type: string; is_hosted_by_me: number }
      | undefined;
    if (!event) {
      res.status(404).json({ code: 404, message: '关联事件不存在' });
      return;
    }
    const expectedType = event.is_hosted_by_me ? 'received' : 'given';
    if (recordType !== expectedType) {
      res.status(400).json({
        code: 400,
        message: event.is_hosted_by_me
          ? '我办的事件只能添加收礼记录'
          : '参加的事件只能添加送礼记录',
      });
      return;
    }
    eventId = event.id;
    eventTitle = event.title;
    eventDate = event.date;
    eventType = event.type;
  } else {
    const title = normalizeString(req.body.eventTitle, 60);
    const date = normalizeDate(req.body.eventDate);
    const type = EVENT_TYPES.has(req.body.eventType) ? req.body.eventType : null;
    if (!title || !date || !type) {
      res.status(400).json({ code: 400, message: '请填写有效的事件名称、日期和类型' });
      return;
    }
    eventTitle = title;
    eventDate = date;
    eventType = type;
  }

  const id = uuid();
  const createRecord = db.transaction(() => {
    let contact = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
      .get(req.userId, contactName) as { id: string } | undefined;
    if (!contact) {
      const contactId = uuid();
      db.prepare(
        'INSERT INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)'
      ).run(contactId, req.userId, contactName, contactRelation, contactRelation);
      contact = { id: contactId };
    }

    db.prepare(
      `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, payment_method, custom_payment_method, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.userId,
      eventId,
      eventTitle,
      eventDate,
      eventType,
      recordType,
      contact.id,
      contactName,
      contactRelation,
      amount,
      paymentMethod,
      paymentMethod === 'custom' ? customPaymentMethod : null,
      remark
    );

    if (eventId) {
      recalculateEvent(eventId, req.userId!);
    }
    writeOperationLog({
      userId: req.userId!,
      eventId,
      recordId: id,
      action: 'record_created',
      entityType: 'record',
      summary:
        recordType === 'received'
          ? `添加宾客 ${contactName}，礼金 ¥${amount.toLocaleString()}`
          : `补记送给 ${contactName} 的礼金 ¥${amount.toLocaleString()}`,
      details: {
        after: {
          contactName,
          contactRelation,
          amount,
          paymentMethod,
          customPaymentMethod: paymentMethod === 'custom' ? customPaymentMethod : null,
          remark,
        },
      },
    });
  });

  createRecord();
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  res.status(201).json({ code: 201, message: '记录添加成功', data: record });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '记录不存在' });
    return;
  }

  const contactName = normalizeString(req.body.contactName, 30);
  const contactRelation = RELATION_TYPES.has(req.body.contactRelation)
    ? req.body.contactRelation
    : null;
  const amount = normalizeAmount(req.body.amount);
  const paymentMethod = PAYMENT_METHODS.has(req.body.paymentMethod) ? req.body.paymentMethod : null;
  const customPaymentMethod = normalizeNullableString(req.body.customPaymentMethod, 20);
  const remark = normalizeNullableString(req.body.remark, 200);

  if (!contactName || !contactRelation || amount === null || !paymentMethod) {
    res.status(400).json({ code: 400, message: '请填写有效的联系人、关系、金额和支付方式' });
    return;
  }
  if (
    customPaymentMethod === undefined ||
    remark === undefined ||
    (paymentMethod === 'custom' && !customPaymentMethod)
  ) {
    res.status(400).json({ code: 400, message: '请填写有效的支付方式和备注' });
    return;
  }

  const eventId = existing.event_id ? String(existing.event_id) : null;
  const updateRecord = db.transaction(() => {
    let contact = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
      .get(req.userId, contactName) as { id: string } | undefined;
    if (!contact) {
      const contactId = uuid();
      db.prepare(
        'INSERT INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)'
      ).run(contactId, req.userId, contactName, contactRelation, contactRelation);
      contact = { id: contactId };
    }

    db.prepare(
      `UPDATE records
       SET contact_id = ?, contact_name = ?, contact_relation = ?, amount = ?,
           payment_method = ?, custom_payment_method = ?, remark = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      contact.id,
      contactName,
      contactRelation,
      amount,
      paymentMethod,
      paymentMethod === 'custom' ? customPaymentMethod : null,
      remark,
      req.params.id,
      req.userId
    );

    if (eventId) recalculateEvent(eventId, req.userId!);
    const updated = db
      .prepare('SELECT * FROM records WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.userId) as Record<string, unknown>;
    const before = recordSnapshot(existing);
    const after = recordSnapshot(updated);
    writeOperationLog({
      userId: req.userId!,
      eventId,
      recordId: req.params.id,
      action: 'record_updated',
      entityType: 'record',
      summary: `修改 ${String(before.contactName)} 的礼金：¥${Number(before.amount).toLocaleString()} → ¥${amount.toLocaleString()}`,
      details: { before, after },
    });
  });

  updateRecord();
  const updated = db
    .prepare('SELECT * FROM records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  res.json({ code: 200, message: '记录修改成功', data: updated });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const record = db
    .prepare('SELECT * FROM records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!record) {
    res.status(404).json({ code: 404, message: '记录不存在' });
    return;
  }

  const deleteRecord = db.transaction(() => {
    db.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    const eventId = record.event_id ? String(record.event_id) : null;
    if (eventId) recalculateEvent(eventId, req.userId!);
    const before = recordSnapshot(record);
    writeOperationLog({
      userId: req.userId!,
      eventId,
      recordId: req.params.id,
      action: 'record_deleted',
      entityType: 'record',
      summary: `删除 ${String(before.contactName)} 的礼金记录 ¥${Number(before.amount).toLocaleString()}`,
      details: { before },
    });
  });
  deleteRecord();
  res.json({ code: 200, message: '删除成功' });
});

export default router;
