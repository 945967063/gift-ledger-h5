import http from './http';
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
  getAll: (params?: {
    type?: 'received' | 'given';
    contactName?: string;
    page?: number;
    pageSize?: number;
  }) => http.get<{ data: { records: RecordApiItem[]; total: number } }>('/records', { params }),

  getAllPages: async () => {
    const pageSize = 500;
    const first = await recordsApi.getAll({ page: 1, pageSize });
    const items = [...first.data.data.records];
    const totalPages = Math.ceil(first.data.data.total / pageSize);
    for (let page = 2; page <= totalPages; page += 1) {
      const response = await recordsApi.getAll({ page, pageSize });
      items.push(...response.data.data.records);
    }
    return items;
  },

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
  getSummary: () =>
    http.get<{
      data: {
        totalIncome: number;
        totalExpense: number;
        netBalance: number;
        recentRecords: any[];
      };
    }>('/stats/summary'),

  getMonthly: (year: number) =>
    http.get<{ data: { month: number; monthLabel: string; received: number; given: number }[] }>(
      '/stats/monthly',
      { params: { year } }
    ),

  getTopContacts: (limit = 5) =>
    http.get<{ data: any[] }>('/stats/top-contacts', { params: { limit } }),

  getCategory: () =>
    http.get<{ data: { label: string; amount: number; percent: number }[] }>('/stats/category'),
};
