import http from './http';

export const recordsApi = {
  getAll: (params?: {
    type?: 'received' | 'given';
    contactName?: string;
    page?: number;
    pageSize?: number;
  }) => http.get<{ data: { records: any[]; total: number } }>('/records', { params }),

  create: (data: {
    eventId?: string;
    eventTitle: string;
    eventDate: string;
    eventType: string;
    type: 'received' | 'given';
    contactName: string;
    contactRelation?: string;
    amount: number;
    remark?: string;
  }) => http.post('/records', data),

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
