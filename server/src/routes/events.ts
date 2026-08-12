import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { recordSnapshot, writeOperationLog } from '../audit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createPaginationMeta, escapeLike, readPagination } from '../pagination';
import {
  EVENT_TYPES,
  normalizeAmount,
  normalizeDate,
  normalizeNullableString,
  normalizeOptionalString,
  normalizeString,
  PAYMENT_METHODS,
  RELATION_TYPES,
} from '../validation';

interface NormalizedGuest {
  name: string;
  amount: number;
  relation: string;
  paymentMethod: string;
  customPaymentMethod: string | null;
  remark: string | null;
}

const router = Router();
router.use(authMiddleware as any);

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: '婚礼',
  baby: '满月',
  housewarming: '乔迁',
  birthday: '生日',
  longevity: '寿宴',
  education: '升学',
  funeral: '白事',
  other: '其他',
};

const normalizeGuest = (guest: unknown): NormalizedGuest | null => {
  if (!guest || typeof guest !== 'object') return null;
  const value = guest as Record<string, unknown>;
  const name = normalizeString(value.name, 30);
  const amount = normalizeAmount(value.amount);
  const relation = RELATION_TYPES.has(value.relation as string) ? String(value.relation) : '朋友';
  const paymentMethod = PAYMENT_METHODS.has(value.paymentMethod as string)
    ? String(value.paymentMethod)
    : 'cash';
  const customPaymentMethod = normalizeNullableString(value.customPaymentMethod, 20);
  const remark = normalizeNullableString(value.remark, 200);

  if (
    !name ||
    amount === null ||
    customPaymentMethod === undefined ||
    remark === undefined ||
    (paymentMethod === 'custom' && !customPaymentMethod)
  ) {
    return null;
  }
  return {
    name,
    amount,
    relation,
    paymentMethod,
    customPaymentMethod: paymentMethod === 'custom' ? customPaymentMethod : null,
    remark,
  };
};

router.get('/', (req: AuthRequest, res: Response) => {
  const hosted = req.query.hosted;
  if (hosted !== undefined && hosted !== 'true' && hosted !== 'false') {
    res.status(400).json({ code: 400, message: '事件归属筛选不合法' });
    return;
  }
  const keyword =
    typeof req.query.keyword === 'string' ? req.query.keyword.trim().slice(0, 60) : '';
  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 100 });
  let sql = 'SELECT * FROM events WHERE user_id = ?';
  const params: Array<string | number> = [req.userId!];
  let countSql =
    'SELECT COUNT(*) AS total, COALESCE(SUM(total_amount), 0) AS totalAmount FROM events WHERE user_id = ?';
  const countParams: Array<string | number> = [req.userId!];

  if (hosted === 'true' || hosted === 'false') {
    const hostedValue = hosted === 'true' ? 1 : 0;
    sql += ' AND is_hosted_by_me = ?';
    countSql += ' AND is_hosted_by_me = ?';
    params.push(hostedValue);
    countParams.push(hostedValue);
  }
  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    const matchingTypes = Object.entries(EVENT_TYPE_LABELS)
      .filter(([type, label]) => type.includes(keyword.toLowerCase()) || label.includes(keyword))
      .map(([type]) => type);
    let keywordSql = `(
      title LIKE ? ESCAPE '\\'
      OR target_contact_name LIKE ? ESCAPE '\\'
      OR notes LIKE ? ESCAPE '\\'
    `;
    const keywordParams: string[] = [pattern, pattern, pattern];
    if (matchingTypes.length) {
      keywordSql += ` OR type IN (${matchingTypes.map(() => '?').join(', ')})`;
      keywordParams.push(...matchingTypes);
    }
    keywordSql += ')';
    sql += ` AND ${keywordSql}`;
    countSql += ` AND ${keywordSql}`;
    params.push(...keywordParams);
    countParams.push(...keywordParams);
  }
  sql += ' ORDER BY date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(pagination.pageSize, pagination.offset);

  const events = db.prepare(sql).all(...params);
  const summary = db.prepare(countSql).get(...countParams) as {
    total: number;
    totalAmount: number;
  };
  const pageMeta = createPaginationMeta(pagination, summary.total);
  res.json({
    code: 200,
    data: events,
    pagination: pageMeta,
    summary: { totalAmount: Number(summary.totalAmount || 0) },
  });
});

router.get('/logs', (req: AuthRequest, res: Response) => {
  const pagination = readPagination(req.query as Record<string, unknown>, {
    defaultPageSize: 20,
    maxPageSize: 200,
    legacyLimit: req.query.limit,
  });
  const logs = db
    .prepare(
      `SELECT * FROM operation_logs
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.userId, pagination.pageSize, pagination.offset);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM operation_logs WHERE user_id = ?')
    .get(req.userId) as { total: number };
  res.json({
    code: 200,
    data: logs,
    pagination: createPaginationMeta(pagination, total),
  });
});

router.get('/:id/logs', (req: AuthRequest, res: Response) => {
  const event = db
    .prepare('SELECT id FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }

  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 200 });
  const logs = db
    .prepare(
      `SELECT * FROM operation_logs
       WHERE event_id = ? AND user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.params.id, req.userId, pagination.pageSize, pagination.offset);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM operation_logs WHERE event_id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as { total: number };
  res.json({
    code: 200,
    data: logs,
    pagination: createPaginationMeta(pagination, total),
  });
});

router.get('/:id/records', (req: AuthRequest, res: Response) => {
  const event = db
    .prepare('SELECT id FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }

  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 200 });
  const records = db
    .prepare(
      `SELECT * FROM records
       WHERE event_id = ? AND user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.params.id, req.userId, pagination.pageSize, pagination.offset);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM records WHERE event_id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as { total: number };
  res.json({
    code: 200,
    data: records,
    pagination: createPaginationMeta(pagination, total),
  });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }
  const pagination = readPagination(req.query as Record<string, unknown>, { maxPageSize: 200 });
  const records = db
    .prepare(
      `SELECT * FROM records
       WHERE event_id = ? AND user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.params.id, req.userId, pagination.pageSize, pagination.offset);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM records WHERE event_id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as { total: number };
  const pageMeta = createPaginationMeta(pagination, total);
  res.json({
    code: 200,
    data: { ...(event as object), records, pagination: pageMeta },
    pagination: pageMeta,
  });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const title = normalizeString(req.body.title, 60);
  const date = normalizeDate(req.body.date);
  const type = EVENT_TYPES.has(req.body.type) ? req.body.type : null;
  const notes = normalizeNullableString(req.body.notes, 500);
  const guests: Array<NormalizedGuest | null> = Array.isArray(req.body.guests)
    ? req.body.guests.map((guest: unknown) => normalizeGuest(guest))
    : [];

  if (!title || !date || !type) {
    res.status(400).json({ code: 400, message: '请填写有效的事件名称、日期和类型' });
    return;
  }
  if (notes === undefined) {
    res.status(400).json({ code: 400, message: '事件备注不能超过 500 个字符' });
    return;
  }
  if (!guests.length || guests.some((guest) => guest === null)) {
    res.status(400).json({ code: 400, message: '请至少添加一条完整、金额有效的宾客礼金' });
    return;
  }

  const normalizedGuests = guests as NormalizedGuest[];
  const eventId = uuid();
  const totalAmount = normalizedGuests.reduce((sum, guest) => sum + guest.amount, 0);
  const insertRecord = db.prepare(
    `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, payment_method, custom_payment_method, remark)
     VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertContact = db.prepare(
    `INSERT INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)`
  );

  const createEvent = db.transaction(() => {
    db.prepare(
      `INSERT INTO events (id, user_id, title, date, type, is_hosted_by_me, total_amount, guest_count, notes)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(eventId, req.userId, title, date, type, totalAmount, normalizedGuests.length, notes);

    writeOperationLog({
      userId: req.userId!,
      eventId,
      action: 'event_created',
      entityType: 'event',
      summary: `创建事件“${title}”`,
      details: { title, date, type, notes },
    });

    for (const guest of normalizedGuests) {
      let contact = db
        .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
        .get(req.userId, guest.name) as { id: string } | undefined;
      if (!contact) {
        const contactId = uuid();
        insertContact.run(contactId, req.userId, guest.name, guest.relation, guest.relation);
        contact = { id: contactId };
      }
      const recordId = uuid();
      insertRecord.run(
        recordId,
        req.userId,
        eventId,
        title,
        date,
        type,
        contact.id,
        guest.name,
        guest.relation,
        guest.amount,
        guest.paymentMethod,
        guest.customPaymentMethod,
        guest.remark
      );
      writeOperationLog({
        userId: req.userId!,
        eventId,
        recordId,
        action: 'record_created',
        entityType: 'record',
        summary: `添加宾客 ${guest.name}，礼金 ¥${guest.amount.toLocaleString()}`,
        details: {
          after: {
            contactName: guest.name,
            contactRelation: guest.relation,
            amount: guest.amount,
            paymentMethod: guest.paymentMethod,
            customPaymentMethod: guest.customPaymentMethod,
            remark: guest.remark,
          },
        },
      });
    }
  });

  createEvent();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  res.status(201).json({ code: 201, message: '事件创建成功', data: event });
});

router.post('/given', (req: AuthRequest, res: Response) => {
  const contactName = normalizeString(req.body.contactName, 30);
  const eventTitle = normalizeString(req.body.eventTitle, 60);
  const date = normalizeDate(req.body.date);
  const type = EVENT_TYPES.has(req.body.type) ? req.body.type : null;
  const amount = normalizeAmount(req.body.amount);
  const relation = RELATION_TYPES.has(req.body.relation) ? req.body.relation : '朋友';
  const paymentMethod = PAYMENT_METHODS.has(req.body.paymentMethod)
    ? req.body.paymentMethod
    : 'cash';
  const customPaymentMethod = normalizeNullableString(req.body.customPaymentMethod, 20);
  const remark = normalizeNullableString(req.body.remark, 200);

  if (!contactName || !eventTitle || !date || !type || amount === null) {
    res.status(400).json({ code: 400, message: '请填写完整、有效的送礼信息' });
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

  const eventId = uuid();
  const createGiven = db.transaction(() => {
    db.prepare(
      `INSERT INTO events (id, user_id, title, date, type, is_hosted_by_me, total_amount, target_contact_name, notes)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(eventId, req.userId, eventTitle, date, type, amount, contactName, remark);

    writeOperationLog({
      userId: req.userId!,
      eventId,
      action: 'event_created',
      entityType: 'event',
      summary: `创建送礼事件“${eventTitle}”`,
      details: { title: eventTitle, date, type, notes: remark },
    });

    let contact = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?')
      .get(req.userId, contactName) as { id: string } | undefined;
    if (!contact) {
      const contactId = uuid();
      db.prepare(
        'INSERT INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)'
      ).run(contactId, req.userId, contactName, relation, relation);
      contact = { id: contactId };
    }

    const recordId = uuid();
    db.prepare(
      `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, payment_method, custom_payment_method, remark)
       VALUES (?, ?, ?, ?, ?, ?, 'given', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recordId,
      req.userId,
      eventId,
      eventTitle,
      date,
      type,
      contact.id,
      contactName,
      relation,
      amount,
      paymentMethod,
      paymentMethod === 'custom' ? customPaymentMethod : null,
      remark
    );
    writeOperationLog({
      userId: req.userId!,
      eventId,
      recordId,
      action: 'record_created',
      entityType: 'record',
      summary: `记录送给 ${contactName} 的礼金 ¥${amount.toLocaleString()}`,
      details: {
        after: {
          contactName,
          contactRelation: relation,
          amount,
          paymentMethod,
          customPaymentMethod: paymentMethod === 'custom' ? customPaymentMethod : null,
          remark,
        },
      },
    });
  });

  createGiven();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  res.status(201).json({ code: 201, message: '送礼记录创建成功', data: event });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }

  const assignments: string[] = [];
  const values: Array<string | null> = [];
  const mirroredAssignments: string[] = [];
  const mirroredValues: string[] = [];

  if ('title' in req.body) {
    const title = normalizeString(req.body.title, 60);
    if (!title) {
      res.status(400).json({ code: 400, message: '事件名称不能为空且不能超过 60 个字符' });
      return;
    }
    assignments.push('title = ?');
    values.push(title);
    mirroredAssignments.push('event_title = ?');
    mirroredValues.push(title);
  }
  if ('date' in req.body) {
    const date = normalizeDate(req.body.date);
    if (!date) {
      res.status(400).json({ code: 400, message: '事件日期格式不正确' });
      return;
    }
    assignments.push('date = ?');
    values.push(date);
    mirroredAssignments.push('event_date = ?');
    mirroredValues.push(date);
  }
  if ('type' in req.body) {
    if (!EVENT_TYPES.has(req.body.type)) {
      res.status(400).json({ code: 400, message: '事件类型不合法' });
      return;
    }
    assignments.push('type = ?');
    values.push(req.body.type);
    mirroredAssignments.push('event_type = ?');
    mirroredValues.push(req.body.type);
  }
  if ('notes' in req.body) {
    const notes = normalizeOptionalString(req.body.notes, 500);
    if (notes === undefined) {
      res.status(400).json({ code: 400, message: '事件备注不能超过 500 个字符' });
      return;
    }
    assignments.push('notes = ?');
    values.push(notes);
  }
  if (!assignments.length) {
    res.status(400).json({ code: 400, message: '没有可更新的字段' });
    return;
  }

  const updateEvent = db.transaction(() => {
    db.prepare(`UPDATE events SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`).run(
      ...values,
      req.params.id,
      req.userId
    );
    if (mirroredAssignments.length) {
      db.prepare(
        `UPDATE records SET ${mirroredAssignments.join(', ')} WHERE event_id = ? AND user_id = ?`
      ).run(...mirroredValues, req.params.id, req.userId);
    }
    const updatedEvent = db
      .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.userId) as Record<string, unknown>;
    writeOperationLog({
      userId: req.userId!,
      eventId: req.params.id,
      action: 'event_updated',
      entityType: 'event',
      summary: `修改事件“${String(updatedEvent.title)}”的资料`,
      details: { before: existing, after: updatedEvent },
    });
  });
  updateEvent();

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json({ code: 200, message: '修改成功', data: updated });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!event) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }

  const removeEvent = db.transaction(() => {
    const records = db
      .prepare('SELECT * FROM records WHERE event_id = ? AND user_id = ?')
      .all(req.params.id, req.userId) as Record<string, unknown>[];
    for (const record of records) {
      writeOperationLog({
        userId: req.userId!,
        eventId: req.params.id,
        recordId: String(record.id),
        action: 'record_deleted',
        entityType: 'record',
        summary: `随事件删除 ${String(record.contact_name)} 的礼金记录`,
        details: { before: recordSnapshot(record) },
      });
    }
    writeOperationLog({
      userId: req.userId!,
      eventId: req.params.id,
      action: 'event_deleted',
      entityType: 'event',
      summary: `删除事件“${String(event.title)}”`,
      details: { before: event },
    });
    db.prepare('DELETE FROM records WHERE event_id = ? AND user_id = ?').run(
      req.params.id,
      req.userId
    );
    db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  });
  removeEvent();
  res.json({ code: 200, message: '删除成功' });
});

export default router;
