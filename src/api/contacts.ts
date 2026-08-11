import http from './http';
import type { Contact } from '@/types/gift';

export const contactsApi = {
  getAll: () => http.get<{ data: Contact[] }>('/contacts'),

  create: (data: Omit<Contact, 'id' | 'createdAt'>) =>
    http.post<{ data: Contact }>('/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    http.put<{ data: Contact }>(`/contacts/${id}`, data),

  remove: (id: string) => http.delete(`/contacts/${id}`),

  getLedger: (name: string) =>
    http.get<{
      data: {
        contact: Contact | undefined;
        records: any[];
        totalReceived: number;
        totalGiven: number;
        receivedCount: number;
        givenCount: number;
        diff: number;
        balanceBadge: string;
      };
    }>(`/contacts/${encodeURIComponent(name)}/ledger`),
};
