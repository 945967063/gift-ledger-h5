import { defineStore } from 'pinia';
import { contactsApi } from '@/api/contacts';
import { eventsApi } from '@/api/events';
import { mapContact, mapEvent, mapRecord } from '@/api/mappers';
import { recordsApi, statsApi } from '@/api/records';
import type {
  Contact,
  EventItem,
  EventType,
  GiftRecord,
  PaymentMethod,
  RelationType,
} from '@/types/gift';

export const EVENT_TYPE_MAP: Record<
  EventType,
  { label: string; icon: string; color: string; bg: string }
> = {
  wedding: { label: '婚礼', icon: 'like-o', color: '#e0524d', bg: '#fff0ef' },
  baby: { label: '满月', icon: 'gift-o', color: '#c78338', bg: '#fff7e8' },
  housewarming: { label: '乔迁', icon: 'wap-home-o', color: '#8e63a9', bg: '#f7effb' },
  birthday: { label: '生日', icon: 'smile-o', color: '#4b83bd', bg: '#edf6ff' },
  longevity: { label: '寿宴', icon: 'flower-o', color: '#c85d83', bg: '#fff0f5' },
  education: { label: '升学', icon: 'award-o', color: '#4f9465', bg: '#edf8f0' },
  funeral: { label: '白事', icon: 'clock-o', color: '#67757e', bg: '#f0f3f4' },
  other: { label: '其他', icon: 'apps-o', color: '#84685d', bg: '#f4efed' },
};

export const PAYMENT_METHOD_MAP: Record<
  PaymentMethod,
  { label: string; icon: string; description: string }
> = {
  cash: { label: '现金', icon: 'cash-back-record', description: '现金礼金或红包' },
  wechat: { label: '微信', icon: 'wechat-pay', description: '微信转账或红包' },
  alipay: { label: '支付宝', icon: 'alipay', description: '支付宝转账' },
  custom: { label: '自定义', icon: 'apps-o', description: '银行卡等其他方式' },
};

export const getPaymentMethodLabel = (
  record: Pick<GiftRecord, 'paymentMethod' | 'customPaymentMethod'>
) => {
  const paymentMethod = record.paymentMethod || 'cash';
  if (paymentMethod === 'custom') {
    return record.customPaymentMethod?.trim() || PAYMENT_METHOD_MAP.custom.label;
  }
  return PAYMENT_METHOD_MAP[paymentMethod].label;
};

const readStoredUserName = () => {
  if (typeof window === 'undefined') return '用户';
  try {
    const user = JSON.parse(localStorage.getItem('gift_ledger_user') || 'null') as {
      name?: string;
    } | null;
    return user?.name || '用户';
  } catch {
    return '用户';
  }
};

let activeLoad: Promise<void> | null = null;

export const useGiftStore = defineStore('giftStore', {
  state: () => ({
    userName: readStoredUserName(),
    contacts: [] as Contact[],
    events: [] as EventItem[],
    records: [] as GiftRecord[],
    summary: {
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
    },
    loading: false,
    loaded: false,
    lastError: '',
  }),
  getters: {
    totalIncome(state): number {
      return state.summary.totalIncome;
    },
    totalExpense(state): number {
      return state.summary.totalExpense;
    },
    netBalance(state): number {
      return state.summary.netBalance;
    },
    recentRecords(state): GiftRecord[] {
      return state.records;
    },
  },
  actions: {
    async refreshSummary() {
      const response = await statsApi.getSummary();
      const data = response.data.data;
      this.summary = {
        totalIncome: Number(data.totalIncome || 0),
        totalExpense: Number(data.totalExpense || 0),
        netBalance: Number(data.netBalance || 0),
      };
      this.records = data.recentRecords.map(mapRecord);
    },

    async refreshQuickContacts() {
      const response = await contactsApi.getAll({ page: 1, pageSize: 20 });
      this.contacts = response.data.data.map(mapContact);
    },

    async refreshDashboard() {
      await Promise.all([this.refreshSummary(), this.refreshQuickContacts()]);
    },

    async loadAll(force = false) {
      if (this.loaded && !force) return;
      if (activeLoad) return activeLoad;

      activeLoad = (async () => {
        this.loading = true;
        this.lastError = '';
        try {
          await this.refreshDashboard();
          this.loaded = true;
        } catch (error) {
          this.loaded = false;
          this.lastError = error instanceof Error ? error.message : '数据加载失败';
          throw error;
        } finally {
          this.loading = false;
          activeLoad = null;
        }
      })();

      return activeLoad;
    },

    resetData() {
      activeLoad = null;
      this.contacts = [];
      this.events = [];
      this.records = [];
      this.summary = { totalIncome: 0, totalExpense: 0, netBalance: 0 };
      this.loaded = false;
      this.loading = false;
      this.lastError = '';
    },

    async addReceivedEventAndGifts(payload: {
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
    }) {
      const response = await eventsApi.createReceived(payload);
      await this.refreshDashboard();
      return mapEvent(response.data.data);
    },

    async addGivenRecord(payload: {
      contactName: string;
      eventTitle: string;
      date: string;
      type: EventType;
      amount: number;
      remark?: string;
      relation?: RelationType;
      paymentMethod?: PaymentMethod;
      customPaymentMethod?: string;
    }) {
      const response = await eventsApi.createGiven(payload);
      await this.refreshDashboard();
      return mapEvent(response.data.data);
    },

    async updateEventInfo(
      eventId: string,
      payload: { title: string; date: string; type: EventType; notes?: string }
    ) {
      const response = await eventsApi.update(eventId, payload);
      const updated = mapEvent(response.data.data);
      const index = this.events.findIndex((event) => event.id === eventId);
      if (index >= 0) this.events[index] = updated;
      await this.refreshSummary();
      return updated;
    },

    async deleteEvent(eventId: string) {
      await eventsApi.remove(eventId);
      this.events = this.events.filter((event) => event.id !== eventId);
      await this.refreshDashboard();
    },

    async addRecordToEvent(
      event: EventItem,
      payload: {
        contactName: string;
        contactRelation: RelationType;
        amount: number;
        paymentMethod: PaymentMethod;
        customPaymentMethod?: string;
        remark?: string;
      }
    ) {
      const response = await recordsApi.create({
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventType: event.type,
        type: event.isHostedByMe ? 'received' : 'given',
        ...payload,
      });
      await this.refreshDashboard();
      return mapRecord(response.data.data);
    },

    async updateGiftRecord(
      recordId: string,
      payload: {
        contactName: string;
        contactRelation: RelationType;
        amount: number;
        paymentMethod: PaymentMethod;
        customPaymentMethod?: string;
        remark?: string;
      }
    ) {
      const response = await recordsApi.update(recordId, payload);
      await this.refreshDashboard();
      return mapRecord(response.data.data);
    },

    async deleteRecord(recordId: string) {
      await recordsApi.remove(recordId);
      await this.refreshDashboard();
    },

    async addContact(contact: Omit<Contact, 'id' | 'createdAt'>) {
      const response = await contactsApi.create(contact);
      const created = mapContact(response.data.data);
      this.contacts = [
        created,
        ...this.contacts.filter((contact) => contact.id !== created.id),
      ].slice(0, 20);
      return created;
    },

    async updateContact(id: string, updates: Partial<Contact>) {
      const response = await contactsApi.update(id, updates);
      const updated = mapContact(response.data.data);
      const index = this.contacts.findIndex((contact) => contact.id === id);
      if (index >= 0) this.contacts[index] = updated;
      return updated;
    },

    async removeContact(id: string) {
      await contactsApi.remove(id);
      this.contacts = this.contacts.filter((contact) => contact.id !== id);
    },

    setUserName(name: string) {
      this.userName = name;
    },
  },
});

export default useGiftStore;
