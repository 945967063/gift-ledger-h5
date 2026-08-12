import http from './http';
import type { PaginationMeta, PaginationParams } from './pagination';
import type { EventType, PaymentMethod, RecordType } from '@/types/gift';

export interface RecordApiItem {
  id: string;
  event_id?: string | null;
  event_title: string;
  event_date: string;
  event_type: EventType;
  type: RecordType;
  contact_id?: string | null;
  contact_name: string;
  contact_relation?: string | null;
  amount: number;
  payment_method?: PaymentMethod | null;
  custom_payment_method?: string | null;
  remark?: string | null;
  created_at: string;
}

export const recordsApi = {
  getAll: (
    params?: {
      type?: 'received' | 'given';
      contactName?: string;
      eventId?: string;
      keyword?: string;
    } & PaginationParams
  ) =>
    http.get<{
      data: {
        records: RecordApiItem[];
        items: RecordApiItem[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      };
      pagination: PaginationMeta;
    }>('/records', { params }),

  create: (data: {
    eventId?: string;
    eventTitle: string;
    eventDate: string;
    eventType: EventType;
    type: 'received' | 'given';
    contactName: string;
    contactRelation?: string;
    amount: number;
    paymentMethod?: PaymentMethod;
    customPaymentMethod?: string;
    remark?: string;
  }) => http.post<{ data: RecordApiItem }>('/records', data),

  update: (
    id: string,
    data: {
      contactName: string;
      contactRelation: string;
      amount: number;
      paymentMethod: PaymentMethod;
      customPaymentMethod?: string;
      remark?: string;
    }
  ) => http.put<{ data: RecordApiItem }>(`/records/${id}`, data),

  remove: (id: string) => http.delete(`/records/${id}`),
};

export const statsApi = {
  getSummary: (year?: number) =>
    http.get<{
      data: {
        totalIncome: number;
        totalExpense: number;
        netBalance: number;
        recentRecords: RecordApiItem[];
      };
    }>('/stats/summary', { params: year ? { year } : {} }),

  getMonthly: (year: number) =>
    http.get<{ data: { month: number; monthLabel: string; received: number; given: number }[] }>(
      '/stats/monthly',
      { params: { year } }
    ),

  getTopContacts: (limit = 5, year?: number) =>
    http.get<{
      data: {
        name: string;
        contact_id?: string | null;
        relation?: string | null;
        tag?: string | null;
        received: number;
        given: number;
        total: number;
      }[];
    }>('/stats/top-contacts', { params: { limit, ...(year ? { year } : {}) } }),

  getCategory: (year?: number) =>
    http.get<{ data: { label: string; amount: number; percent: number }[] }>('/stats/category', {
      params: year ? { year } : {},
    }),

  getYears: () => http.get<{ data: number[] }>('/stats/years'),
};
