import http from './http';
import type { EventItem, EventType, RelationType } from '@/types/gift';

export const eventsApi = {
  getAll: (hosted?: boolean) =>
    http.get<{ data: EventItem[] }>('/events', {
      params: hosted !== undefined ? { hosted } : {},
    }),

  getById: (id: string) => http.get<{ data: EventItem & { records: any[] } }>(`/events/${id}`),

  // 新建收礼事件（我办的，含宾客名单）
  createReceived: (data: {
    title: string;
    date: string;
    type: EventType;
    notes?: string;
    guests: { name: string; amount: number; relation?: RelationType }[];
  }) => http.post<{ data: EventItem }>('/events', { ...data, isHostedByMe: true }),

  // 新建送礼记录（参加别人的活动）
  createGiven: (data: {
    contactName: string;
    eventTitle: string;
    date: string;
    type: EventType;
    amount: number;
    remark?: string;
    relation?: RelationType;
  }) => http.post<{ data: EventItem }>('/events/given', data),

  update: (id: string, data: Partial<EventItem>) =>
    http.put<{ data: EventItem }>(`/events/${id}`, data),

  remove: (id: string) => http.delete(`/events/${id}`),
};
