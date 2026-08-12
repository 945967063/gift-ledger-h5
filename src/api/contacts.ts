import http from './http';
import type { Contact, RelationType } from '@/types/gift';
import type { RecordApiItem } from './records';
import type { PaginatedApiData, PaginationMeta, PaginationParams } from './pagination';

export interface ContactApiItem {
  id: string;
  name: string;
  relation: RelationType;
  tag?: string | null;
  phone?: string | null;
  remark?: string | null;
  avatar_bg?: string | null;
  created_at: string;
  total_received?: number;
  total_given?: number;
  received_count?: number;
  given_count?: number;
  diff?: number;
  balance_badge?: string;
}

export const contactsApi = {
  getAll: (params?: { keyword?: string; relation?: RelationType } & PaginationParams) =>
    http.get<PaginatedApiData<ContactApiItem>>('/contacts', { params }),

  create: (data: Omit<Contact, 'id' | 'createdAt'>) =>
    http.post<{ data: ContactApiItem }>('/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    http.put<{ data: ContactApiItem }>(`/contacts/${id}`, data),

  remove: (id: string) => http.delete(`/contacts/${id}`),

  getLedger: (identifier: string, params?: PaginationParams) =>
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
        pagination: PaginationMeta;
      };
      pagination: PaginationMeta;
    }>(`/contacts/${encodeURIComponent(identifier)}/ledger`, { params }),
};
