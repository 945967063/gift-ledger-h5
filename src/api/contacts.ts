import http from './http';
import type { Contact, RelationType } from '@/types/gift';
import type { RecordApiItem } from './records';

export interface ContactApiItem {
  id: string;
  name: string;
  relation: RelationType;
  tag?: string | null;
  phone?: string | null;
  remark?: string | null;
  avatar_bg?: string | null;
  created_at: string;
}

export const contactsApi = {
  getAll: () => http.get<{ data: ContactApiItem[] }>('/contacts'),

  create: (data: Omit<Contact, 'id' | 'createdAt'>) =>
    http.post<{ data: ContactApiItem }>('/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    http.put<{ data: ContactApiItem }>(`/contacts/${id}`, data),

  remove: (id: string) => http.delete(`/contacts/${id}`),

  getLedger: (name: string) =>
    http.get<{
      data: {
        contact: ContactApiItem | null;
        records: RecordApiItem[];
        totalReceived: number;
        totalGiven: number;
        receivedCount: number;
        givenCount: number;
        diff: number;
        balanceBadge: string;
      };
    }>(`/contacts/${encodeURIComponent(name)}/ledger`),
};
