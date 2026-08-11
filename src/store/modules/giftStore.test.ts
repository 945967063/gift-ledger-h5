import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const apiMocks = vi.hoisted(() => ({
  getContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
  getEvents: vi.fn(),
  createReceived: vi.fn(),
  createGiven: vi.fn(),
  getRecords: vi.fn(),
  removeRecord: vi.fn(),
}));

vi.mock('@/api/contacts', () => ({
  contactsApi: {
    getAll: apiMocks.getContacts,
    create: apiMocks.createContact,
    update: apiMocks.updateContact,
    remove: apiMocks.removeContact,
  },
}));
vi.mock('@/api/events', () => ({
  eventsApi: {
    getAll: apiMocks.getEvents,
    createReceived: apiMocks.createReceived,
    createGiven: apiMocks.createGiven,
  },
}));
vi.mock('@/api/records', () => ({
  recordsApi: {
    getAllPages: apiMocks.getRecords,
    remove: apiMocks.removeRecord,
  },
}));

import { useGiftStore } from './giftStore';

const contactApiItem = {
  id: 'c1',
  name: '测试联系人',
  relation: '朋友' as const,
  tag: '朋友',
  phone: null,
  remark: null,
  avatar_bg: null,
  created_at: '2026-08-11 10:00:00',
};
const eventApiItem = {
  id: 'e1',
  title: '测试婚礼',
  date: '2026-08-11',
  type: 'wedding' as const,
  is_hosted_by_me: 1 as const,
  total_amount: 500,
  guest_count: 1,
  target_contact_name: null,
  notes: null,
  created_at: '2026-08-11 10:00:00',
};
const recordApiItem = {
  id: 'r1',
  event_id: 'e1',
  event_title: '测试婚礼',
  event_date: '2026-08-11',
  event_type: 'wedding' as const,
  type: 'received' as const,
  contact_id: 'c1',
  contact_name: '测试联系人',
  contact_relation: '朋友',
  amount: 500,
  payment_method: 'cash' as const,
  custom_payment_method: null,
  remark: null,
  created_at: '2026-08-11 10:00:00',
};

describe('gift store 远端数据流', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    apiMocks.getContacts.mockResolvedValue({ data: { data: [contactApiItem] } });
    apiMocks.getEvents.mockResolvedValue({ data: { data: [eventApiItem] } });
    apiMocks.getRecords.mockResolvedValue([recordApiItem]);
  });

  it('初始不再注入演示数据，并从 API 加载当前账号数据', async () => {
    const store = useGiftStore();
    expect(store.contacts).toEqual([]);
    expect(store.records).toEqual([]);

    await store.loadAll();

    expect(store.loaded).toBe(true);
    expect(store.contacts[0].name).toBe('测试联系人');
    expect(store.events[0].isHostedByMe).toBe(true);
    expect(store.records[0].paymentMethod).toBe('cash');
    expect(store.totalIncome).toBe(500);
    expect(store.totalExpense).toBe(0);
  });

  it('送礼成功后强制重新同步后端权威数据', async () => {
    const store = useGiftStore();
    await store.loadAll();
    apiMocks.createGiven.mockResolvedValue({ data: { data: {} } });
    apiMocks.getRecords.mockResolvedValueOnce([
      recordApiItem,
      {
        ...recordApiItem,
        id: 'r2',
        type: 'given',
        amount: 200,
        payment_method: 'alipay',
        contact_name: '另一联系人',
      },
    ]);

    await store.addGivenRecord({
      contactName: '另一联系人',
      eventTitle: '生日宴',
      date: '2026-08-11',
      type: 'birthday',
      amount: 200,
      paymentMethod: 'alipay',
    });

    expect(apiMocks.createGiven).toHaveBeenCalledOnce();
    expect(apiMocks.getRecords).toHaveBeenCalledTimes(2);
    expect(store.totalExpense).toBe(200);
  });

  it('更新联系人后重新拉取关联数据', async () => {
    const store = useGiftStore();
    await store.loadAll();
    const updatedContact = { ...contactApiItem, tag: '重要客户' };
    apiMocks.updateContact.mockResolvedValue({ data: { data: updatedContact } });
    apiMocks.getContacts.mockResolvedValueOnce({ data: { data: [updatedContact] } });

    const result = await store.updateContact('c1', { tag: '重要客户' });

    expect(apiMocks.updateContact).toHaveBeenCalledOnce();
    expect(apiMocks.getRecords).toHaveBeenCalledTimes(2);
    expect(result.tag).toBe('重要客户');
    expect(store.contacts[0].tag).toBe('重要客户');
  });

  it('退出账号时清空所有业务数据，避免跨账号残留', async () => {
    const store = useGiftStore();
    await store.loadAll();
    store.resetData();
    expect(store.contacts).toEqual([]);
    expect(store.events).toEqual([]);
    expect(store.records).toEqual([]);
    expect(store.loaded).toBe(false);
  });
});
