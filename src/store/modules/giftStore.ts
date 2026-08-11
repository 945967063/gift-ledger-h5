import { defineStore } from 'pinia';
import { contactsApi } from '@/api/contacts';
import { eventsApi } from '@/api/events';
import { mapContact, mapEvent, mapRecord } from '@/api/mappers';
import { recordsApi } from '@/api/records';
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
    loading: false,
    loaded: false,
    lastError: '',
  }),
  getters: {
    totalIncome(state): number {
      return state.records
        .filter((record) => record.type === 'received')
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    },
    totalExpense(state): number {
      return state.records
        .filter((record) => record.type === 'given')
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    },
    netBalance(): number {
      return this.totalIncome - this.totalExpense;
    },
    recentRecords(state): GiftRecord[] {
      return [...state.records]
        .sort((a, b) => {
          const aTime = new Date((a.createdAt || a.eventDate).replace(' ', 'T')).getTime();
          const bTime = new Date((b.createdAt || b.eventDate).replace(' ', 'T')).getTime();
          return bTime - aTime;
        })
        .slice(0, 4);
    },
    myHostedEvents(state): EventItem[] {
      return state.events
        .filter((event) => event.isHostedByMe)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    attendedEvents(state): EventItem[] {
      return state.events
        .filter((event) => !event.isHostedByMe)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  },
  actions: {
    async loadAll(force = false) {
      if (this.loaded && !force) return;
      if (activeLoad) return activeLoad;

      activeLoad = (async () => {
        this.loading = true;
        this.lastError = '';
        try {
          const [contactsResponse, eventsResponse, recordItems] = await Promise.all([
            contactsApi.getAll(),
            eventsApi.getAll(),
            recordsApi.getAllPages(),
          ]);
          this.contacts = contactsResponse.data.data.map(mapContact);
          this.events = eventsResponse.data.data.map(mapEvent);
          this.records = recordItems.map(mapRecord);
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
      }[];
    }) {
      await eventsApi.createReceived(payload);
      await this.loadAll(true);
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
      await eventsApi.createGiven(payload);
      await this.loadAll(true);
    },

    async deleteRecord(recordId: string) {
      await recordsApi.remove(recordId);
      await this.loadAll(true);
    },

    getContactDetail(contactIdentifier: string) {
      const contact = this.contacts.find(
        (item) => item.id === contactIdentifier || item.name === contactIdentifier
      );
      const name = contact ? contact.name : contactIdentifier;
      const records = this.records
        .filter((record) => record.contactName === name || record.contactId === contact?.id)
        .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
      const receivedList = records.filter((record) => record.type === 'received');
      const givenList = records.filter((record) => record.type === 'given');
      const totalReceived = receivedList.reduce((sum, record) => sum + Number(record.amount), 0);
      const totalGiven = givenList.reduce((sum, record) => sum + Number(record.amount), 0);
      const diff = totalReceived - totalGiven;
      let balanceBadge = '往来平衡';
      if (diff > 0) balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
      else if (diff < 0) balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;

      return {
        contact,
        records,
        receivedCount: receivedList.length,
        totalReceived,
        givenCount: givenList.length,
        totalGiven,
        diff,
        balanceBadge,
      };
    },

    getTopExchangedContacts(limit = 5) {
      const statsMap = new Map<
        string,
        {
          name: string;
          contact?: Contact;
          relation: string;
          tag: string;
          received: number;
          given: number;
          total: number;
        }
      >();

      this.records.forEach((record) => {
        if (!record.contactName) return;
        const contact = this.contacts.find((item) => item.name === record.contactName);
        const entry = statsMap.get(record.contactName) || {
          name: record.contactName,
          contact,
          relation: record.contactRelation || contact?.relation || '朋友',
          tag: contact?.tag || record.contactRelation || '朋友',
          received: 0,
          given: 0,
          total: 0,
        };
        if (record.type === 'received') entry.received += Number(record.amount);
        else entry.given += Number(record.amount);
        entry.total = entry.received + entry.given;
        statsMap.set(record.contactName, entry);
      });

      return Array.from(statsMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
    },

    getMonthlyStats(year: number) {
      const months = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        monthLabel: `${index + 1}月`,
        received: 0,
        given: 0,
      }));

      this.records.forEach((record) => {
        const date = new Date(record.eventDate || record.createdAt);
        if (date.getFullYear() !== year) return;
        const month = date.getMonth();
        if (record.type === 'received') months[month].received += Number(record.amount);
        else months[month].given += Number(record.amount);
      });
      return months;
    },

    async addContact(contact: Omit<Contact, 'id' | 'createdAt'>) {
      const response = await contactsApi.create(contact);
      const created = mapContact(response.data.data);
      this.contacts.unshift(created);
      return created;
    },

    async updateContact(id: string, updates: Partial<Contact>) {
      const response = await contactsApi.update(id, updates);
      const updated = mapContact(response.data.data);
      await this.loadAll(true);
      return this.contacts.find((contact) => contact.id === id) || updated;
    },

    async removeContact(id: string) {
      await contactsApi.remove(id);
      await this.loadAll(true);
    },

    setUserName(name: string) {
      this.userName = name;
    },
  },
});

export default useGiftStore;
