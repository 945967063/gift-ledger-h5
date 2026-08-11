import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware as any);

// GET /api/events?hosted=true|false
router.get('/', (req: AuthRequest, res: Response) => {
  const { hosted } = req.query;

  let sql = 'SELECT * FROM events WHERE user_id = ?';
  const params: (string | number)[] = [req.userId!];

  if (hosted === 'true') {
    sql += ' AND is_hosted_by_me = 1';
  } else if (hosted === 'false') {
    sql += ' AND is_hosted_by_me = 0';
  }
  sql += ' ORDER BY date DESC';

  const events = db.prepare(sql).all(...params);
  res.json({ code: 200, data: events });
});

// GET /api/events/:id — 获取单个事件（含宾客记录）
router.get('/:id', (req: AuthRequest, res: Response) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }
  const records = db
    .prepare('SELECT * FROM records WHERE event_id = ? AND user_id = ?')
    .all(req.params.id, req.userId);
  res.json({ code: 200, data: { ...(event as object), records } });
});

// POST /api/events — 新建收礼事件（含批量宾客礼金）
router.post('/', (req: AuthRequest, res: Response) => {
  const { title, date, type, isHostedByMe, notes, guests } = req.body;

  if (!title || !date) {
    res.status(400).json({ code: 400, message: '事件名称和日期不能为空' });
    return;
  }

  const eventId = uuid();
  const isHosted = isHostedByMe !== false ? 1 : 0;

  // Calculate total from guests if provided
  let totalAmount = 0;
  let guestCount = 0;

  if (Array.isArray(guests) && guests.length > 0) {
    totalAmount = guests.reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0);
    guestCount = guests.length;
  }

  db.prepare(
    `INSERT INTO events (id, user_id, title, date, type, is_hosted_by_me, total_amount, guest_count, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    req.userId,
    title,
    date,
    type || 'other',
    isHosted,
    totalAmount,
    guestCount || null,
    notes || null
  );

  // Insert gift records for each guest
  if (Array.isArray(guests) && guests.length > 0) {
    const insertRecord = db.prepare(
      `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertContact = db.prepare(
      `INSERT OR IGNORE INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((guestList: any[]) => {
      for (const g of guestList) {
        // Upsert contact
        let contact = db
          .prepare('SELECT * FROM contacts WHERE user_id = ? AND name = ?')
          .get(req.userId, g.name) as any;
        if (!contact && g.name?.trim()) {
          const contactId = uuid();
          insertContact.run(
            contactId,
            req.userId,
            g.name.trim(),
            g.relation || '朋友',
            g.relation || '朋友'
          );
          contact = { id: contactId };
        }

        insertRecord.run(
          uuid(),
          req.userId,
          eventId,
          title,
          date,
          type || 'other',
          isHosted ? 'received' : 'given',
          contact?.id || null,
          g.name?.trim() || '',
          g.relation || '朋友',
          Number(g.amount || 0),
          g.remark || null
        );
      }
    });

    insertMany(guests);
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  res.json({ code: 200, message: '事件创建成功', data: event });
});

// POST /api/events/given — 新建送礼记录（参加别人的活动）
router.post('/given', (req: AuthRequest, res: Response) => {
  const { contactName, eventTitle, date, type, amount, remark, relation } = req.body;

  if (!contactName || !eventTitle || !amount) {
    res.status(400).json({ code: 400, message: '对方姓名、事件名称和金额不能为空' });
    return;
  }

  const eventId = uuid();
  db.prepare(
    `INSERT INTO events (id, user_id, title, date, type, is_hosted_by_me, total_amount, target_contact_name, notes)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(
    eventId,
    req.userId,
    eventTitle,
    date,
    type || 'other',
    Number(amount),
    contactName,
    remark || null
  );

  // Upsert contact
  let contact = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? AND name = ?')
    .get(req.userId, contactName) as any;
  if (!contact && contactName.trim()) {
    const contactId = uuid();
    db.prepare(
      'INSERT OR IGNORE INTO contacts (id, user_id, name, relation, tag) VALUES (?, ?, ?, ?, ?)'
    ).run(contactId, req.userId, contactName.trim(), relation || '朋友', relation || '朋友');
    contact = { id: contactId };
  }

  db.prepare(
    `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, remark)
     VALUES (?, ?, ?, ?, ?, ?, 'given', ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    req.userId,
    eventId,
    eventTitle,
    date,
    type || 'other',
    contact?.id || null,
    contactName.trim(),
    relation || '朋友',
    Number(amount),
    remark || null
  );

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  res.json({ code: 200, message: '送礼记录创建成功', data: event });
});

// PUT /api/events/:id
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(id, req.userId);

  if (!existing) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }

  const { title, date, type, notes } = req.body;
  db.prepare(
    `UPDATE events SET
      title = COALESCE(?, title),
      date = COALESCE(?, date),
      type = COALESCE(?, type),
      notes = COALESCE(?, notes)
     WHERE id = ? AND user_id = ?`
  ).run(title || null, date || null, type || null, notes || null, id, req.userId);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json({ code: 200, message: '修改成功', data: updated });
});

// DELETE /api/events/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const result = db
    .prepare('DELETE FROM events WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (result.changes === 0) {
    res.status(404).json({ code: 404, message: '事件不存在' });
    return;
  }
  res.json({ code: 200, message: '删除成功' });
});

export default router;
