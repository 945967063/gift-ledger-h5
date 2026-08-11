import http from './http';
import type {
  EventItem,
  EventType,
  OperationAction,
  PaymentMethod,
  RelationType,
} from '@/types/gift';
import type { RecordApiItem } from './records';

export interface EventApiItem {
  id: string;
  title: string;
  date: string;
  type: EventType;
  is_hosted_by_me: 0 | 1;
  total_amount: number;
  guest_count?: number | null;
  target_contact_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface OperationLogApiItem {
  id: string;
  event_id?: string | null;
  record_id?: string | null;
  action: OperationAction;
  entity_type: 'event' | 'record' | 'contact';
  summary: string;
  details?: string | null;
  created_at: string;
}

export const eventsApi = {
  getAll: (hosted?: boolean) =>
    http.get<{ data: EventApiItem[] }>('/events', {
      params: hosted !== undefined ? { hosted } : {},
    }),

  getById: (id: string) =>
    http.get<{ data: EventApiItem & { records: RecordApiItem[] } }>(`/events/${id}`),

  getLogs: (id: string) => http.get<{ data: OperationLogApiItem[] }>(`/events/${id}/logs`),

  getAllLogs: (limit = 100) =>
    http.get<{ data: OperationLogApiItem[] }>('/events/logs', { params: { limit } }),

  // 新建收礼事件（我办的，含宾客名单）
  createReceived: (data: {
    title: string;
    date: string;
    type: EventType;
    notes?: string;
    guests: {
      name: string;
      amount: number;
      relation?: RelationType;
      paymentMethod?: PaymentMethod;
      customPaymentMethod?: string;
      remark?: string;
    }[];
  }) => http.post<{ data: EventApiItem }>('/events', data),

  // 新建送礼记录（参加别人的活动）
  createGiven: (data: {
    contactName: string;
    eventTitle: string;
    date: string;
    type: EventType;
    amount: number;
    remark?: string;
    relation?: RelationType;
    paymentMethod?: PaymentMethod;
    customPaymentMethod?: string;
  }) => http.post<{ data: EventApiItem }>('/events/given', data),

  update: (id: string, data: Partial<EventItem>) =>
    http.put<{ data: EventApiItem }>(`/events/${id}`, data),

  remove: (id: string) => http.delete(`/events/${id}`),
};
