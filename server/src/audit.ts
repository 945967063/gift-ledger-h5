import { v4 as uuid } from 'uuid';
import db from './db';

export type OperationAction =
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'contact_created'
  | 'contact_updated'
  | 'contact_deleted';

interface OperationLogInput {
  userId: string;
  eventId?: string | null;
  recordId?: string | null;
  action: OperationAction;
  entityType: 'event' | 'record' | 'contact';
  summary: string;
  details?: unknown;
}

export const writeOperationLog = ({
  userId,
  eventId = null,
  recordId = null,
  action,
  entityType,
  summary,
  details,
}: OperationLogInput) => {
  db.prepare(
    `INSERT INTO operation_logs
      (id, user_id, event_id, record_id, action, entity_type, summary, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    userId,
    eventId,
    recordId,
    action,
    entityType,
    summary,
    details === undefined ? null : JSON.stringify(details)
  );
};

export const recalculateEvent = (eventId: string, userId: string) => {
  db.prepare(
    `UPDATE events
     SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM records WHERE event_id = ?),
         guest_count = (SELECT COUNT(*) FROM records WHERE event_id = ?)
     WHERE id = ? AND user_id = ?`
  ).run(eventId, eventId, eventId, userId);

  const event = db
    .prepare('SELECT is_hosted_by_me FROM events WHERE id = ? AND user_id = ?')
    .get(eventId, userId) as { is_hosted_by_me: number } | undefined;
  if (event && !event.is_hosted_by_me) {
    db.prepare(
      `UPDATE events
       SET target_contact_name = (
         SELECT contact_name FROM records WHERE event_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 1
       )
       WHERE id = ? AND user_id = ?`
    ).run(eventId, eventId, userId);
  }
};

export const recordSnapshot = (record: Record<string, unknown>) => ({
  contactName: record.contact_name,
  contactRelation: record.contact_relation,
  amount: Number(record.amount || 0),
  paymentMethod: record.payment_method,
  customPaymentMethod: record.custom_payment_method,
  remark: record.remark,
});
