import http from './http';
import type {
  EventItem,
  EventType,
  OperationAction,
  PaymentMethod,
  RelationType,
} from '@/types/gift';
import type { RecordApiItem } from './records';
import type { PaginatedApiData, PaginationMeta, PaginationParams } from './pagination';

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
  getAll: (params?: { hosted?: boolean; keyword?: string } & PaginationParams) =>
    http.get<PaginatedApiData<EventApiItem> & { summary: { totalAmount: number } }>('/events', {
      params,
    }),

  getById: (id: string, params?: PaginationParams) =>
    http.get<{
      data: EventApiItem & { records: RecordApiItem[]; pagination: PaginationMeta };
      pagination: PaginationMeta;
    }>(`/events/${id}`, { params }),

  getRecords: (id: string, params?: PaginationParams) =>
    http.get<PaginatedApiData<RecordApiItem>>(`/events/${id}/records`, { params }),

  getLogs: (id: string, params?: PaginationParams) =>
    http.get<PaginatedApiData<OperationLogApiItem>>(`/events/${id}/logs`, { params }),

  getAllLogs: (params?: PaginationParams) =>
    http.get<PaginatedApiData<OperationLogApiItem>>('/events/logs', { params }),

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
