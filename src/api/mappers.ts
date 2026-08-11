import type { ContactApiItem } from './contacts';
import type { EventApiItem, OperationLogApiItem } from './events';
import type { RecordApiItem } from './records';
import type {
  Contact,
  EventItem,
  EventType,
  GiftRecord,
  OperationLog,
  PaymentMethod,
  RecordType,
} from '@/types/gift';

const EVENT_TYPES = new Set<EventType>([
  'wedding',
  'baby',
  'housewarming',
  'birthday',
  'longevity',
  'education',
  'funeral',
  'other',
]);
const PAYMENT_METHODS = new Set<PaymentMethod>(['cash', 'wechat', 'alipay', 'custom']);
const RECORD_TYPES = new Set<RecordType>(['received', 'given']);

const asEventType = (value: string): EventType =>
  EVENT_TYPES.has(value as EventType) ? (value as EventType) : 'other';
const asPaymentMethod = (value?: string | null): PaymentMethod =>
  PAYMENT_METHODS.has(value as PaymentMethod) ? (value as PaymentMethod) : 'cash';
const asRecordType = (value: string): RecordType =>
  RECORD_TYPES.has(value as RecordType) ? (value as RecordType) : 'given';

export const mapContact = (item: ContactApiItem): Contact => ({
  id: item.id,
  name: item.name,
  relation: item.relation || '朋友',
  tag: item.tag || undefined,
  phone: item.phone || undefined,
  remark: item.remark || undefined,
  avatarBg: item.avatar_bg || undefined,
  createdAt: item.created_at,
});

export const mapEvent = (item: EventApiItem): EventItem => ({
  id: item.id,
  title: item.title,
  date: item.date,
  type: asEventType(item.type),
  isHostedByMe: Boolean(item.is_hosted_by_me),
  totalAmount: Number(item.total_amount || 0),
  guestCount: item.guest_count ?? undefined,
  targetContactName: item.target_contact_name || undefined,
  notes: item.notes || undefined,
  createdAt: item.created_at,
});

export const mapRecord = (item: RecordApiItem): GiftRecord => ({
  id: item.id,
  eventId: item.event_id || undefined,
  eventTitle: item.event_title,
  eventDate: item.event_date,
  eventType: asEventType(item.event_type),
  type: asRecordType(item.type),
  contactId: item.contact_id || undefined,
  contactName: item.contact_name,
  contactRelation: item.contact_relation || undefined,
  amount: Number(item.amount || 0),
  paymentMethod: asPaymentMethod(item.payment_method),
  customPaymentMethod: item.custom_payment_method || undefined,
  remark: item.remark || undefined,
  createdAt: item.created_at,
});

export const mapOperationLog = (item: OperationLogApiItem): OperationLog => {
  let details: OperationLog['details'];
  if (item.details) {
    try {
      details = JSON.parse(item.details) as OperationLog['details'];
    } catch {
      details = undefined;
    }
  }
  return {
    id: item.id,
    eventId: item.event_id || undefined,
    recordId: item.record_id || undefined,
    action: item.action,
    entityType: item.entity_type,
    summary: item.summary,
    details,
    createdAt: item.created_at,
  };
};
