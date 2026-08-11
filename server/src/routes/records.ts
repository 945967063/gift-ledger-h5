import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  EVENT_TYPES,
  normalizeAmount,
  normalizeDate,
  normalizeNullableString,
  normalizePage,
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
  const page = normalizePage(req.query.page, 1, 1_000_000);
  const pageSize = normalizePage(req.query.pageSize, 20, 500);
  const offset = (page - 1) * pageSize;

  if (type && !RECORD_TYPES.has(type)) {
    res.status(400).json({ code: 400, message: '收送礼类型不合法' });
    return;
  }
  if (req.query.contactName !== undefined && !contactName) {
    res.status(400).json({ code: 400, message: '联系人姓名不合法' });
    return;
  }

  let sql = 'SELECT * FROM records WHERE user_id = ?';
  const params: Array<string | number | undefined> = [req.userId];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (contactName) {
    sql += ' AND contact_name = ?';
    params.push(contactName);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);
  const records = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as total FROM records WHERE user_id = ?';
  const countParams: Array<string | undefined> = [req.userId];
  if (type) {
    countSql += ' AND type = ?';
    countParams.push(type);
  }
  if (contactName) {
    countSql += ' AND contact_name = ?';
    countParams.push(contactName);
  }
  const { total } = db.prepare(countSql).get(...countParams) as { total: number };

  res.json({ code: 200, data: { records, total, page, pageSize } });
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
      .prepare('SELECT id, title, date, type FROM events WHERE id = ? AND user_id = ?')
      .get(req.body.eventId, req.userId) as
      | { id: string; title: string; date: string; type: string }
      | undefined;
    if (!event) {
      res.status(404).json({ code: 404, message: '关联事件不存在' });
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
      db.prepare(
        `UPDATE events
         SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM records WHERE event_id = ?),
             guest_count = (SELECT COUNT(*) FROM records WHERE event_id = ?)
         WHERE id = ? AND user_id = ?`
      ).run(eventId, eventId, eventId, req.userId);
    }
  });

  createRecord();
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  res.status(201).json({ code: 201, message: '记录添加成功', data: record });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const record = db
    .prepare('SELECT id, event_id FROM records WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as { id: string; event_id: string | null } | undefined;
  if (!record) {
    res.status(404).json({ code: 404, message: '记录不存在' });
    return;
  }

  const deleteRecord = db.transaction(() => {
    db.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    if (record.event_id) {
      db.prepare(
        `UPDATE events
         SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM records WHERE event_id = ?),
             guest_count = (SELECT COUNT(*) FROM records WHERE event_id = ?)
         WHERE id = ? AND user_id = ?`
      ).run(record.event_id, record.event_id, record.event_id, req.userId);
    }
  });
  deleteRecord();
  res.json({ code: 200, message: '删除成功' });
});

export default router;
