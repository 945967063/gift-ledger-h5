import { defineStore } from 'pinia';
import type { Contact, EventItem, GiftRecord, EventType, RelationType } from '@/types/gift';

export const EVENT_TYPE_MAP: Record<
  EventType,
  { label: string; icon: string; color: string; bg: string }
> = {
  wedding: { label: '婚礼', icon: 'like-o', color: '#E53935', bg: '#FFEBEE' },
  baby: { label: '满月', icon: 'gift-o', color: '#FB8C00', bg: '#FFF3E0' },
  housewarming: { label: '乔迁', icon: 'wap-home-o', color: '#8E24AA', bg: '#F3E5F5' },
  birthday: { label: '生日', icon: 'smile-o', color: '#1E88E5', bg: '#E3F2FD' },
  longevity: { label: '寿宴', icon: 'flower-o', color: '#D81B60', bg: '#FCE4EC' },
  education: { label: '升学', icon: 'award-o', color: '#43A047', bg: '#E8F5E9' },
  funeral: { label: '白事', icon: 'clock-o', color: '#546E7A', bg: '#ECEFF1' },
  other: { label: '其他', icon: 'apps-o', color: '#6D4C41', bg: '#EFEBE9' },
};

const initialContacts: Contact[] = [
  {
    id: 'c-1',
    name: '王大力',
    relation: '同学',
    tag: '常来往宾客 · 大学同学',
    avatarBg: '#E6A23C',
    phone: '13800138001',
    remark: '大学室友兼铁哥们',
    createdAt: '2023-01-01',
  },
  {
    id: 'c-2',
    name: '李小花',
    relation: '同事',
    tag: '同事',
    avatarBg: '#67C23A',
    phone: '13800138002',
    remark: '同组产品经理',
    createdAt: '2023-02-10',
  },
  {
    id: 'c-3',
    name: '张三丰',
    relation: '合作伙伴',
    tag: '合作伙伴',
    avatarBg: '#409EFF',
    phone: '13800138003',
    remark: '武当科技总经理',
    createdAt: '2023-03-15',
  },
  {
    id: 'c-4',
    name: '刘洋',
    relation: '亲戚',
    tag: '表哥',
    avatarBg: '#F56C6C',
    phone: '13800138004',
    remark: '大舅家表哥',
    createdAt: '2023-01-01',
  },
  {
    id: 'c-5',
    name: '赵敏',
    relation: '朋友',
    tag: '闺蜜',
    avatarBg: '#909399',
    phone: '13800138005',
    remark: '高中同桌',
    createdAt: '2023-01-10',
  },
];

const initialEvents: EventItem[] = [
  {
    id: 'e-1',
    title: '小明孩子满月宴',
    date: '2024-10-01',
    type: 'baby',
    isHostedByMe: true,
    totalAmount: 12000,
    guestCount: 25,
    notes: '在江南大酒店举办百日宴',
  },
  {
    id: 'e-2',
    title: '小明婚礼',
    date: '2024-01-15',
    type: 'wedding',
    isHostedByMe: true,
    totalAmount: 18600,
    guestCount: 32,
    notes: '香格里拉大酒店喜宴',
  },
  {
    id: 'e-3',
    title: '王大力乔迁宴',
    date: '2024-06-18',
    type: 'housewarming',
    isHostedByMe: false,
    totalAmount: 600,
    targetContactName: '王大力',
    notes: '王大力万科新房入伙',
  },
  {
    id: 'e-4',
    title: '乔迁新居宴',
    date: '2023-05-12',
    type: 'housewarming',
    isHostedByMe: true,
    totalAmount: 8000,
    guestCount: 15,
    notes: '幸福花园新家暖房',
  },
];

const initialRecords: GiftRecord[] = [
  // 1. 最近记录 1: 王大力乔迁宴 -¥600 今天
  {
    id: 'r-1',
    eventId: 'e-3',
    eventTitle: '王大力乔迁宴',
    eventDate: '2024-06-18',
    eventType: 'housewarming',
    type: 'given',
    contactId: 'c-1',
    contactName: '王大力',
    contactRelation: '大学同学',
    amount: 600,
    remark: '恭喜乔迁新居！',
    createdAt: '2026-08-11 12:00:00', // Today
  },
  // 2. 最近记录 2: 李小花 小明孩子满月宴 +¥1,000 昨天
  {
    id: 'r-2',
    eventId: 'e-1',
    eventTitle: '小明孩子满月宴',
    eventDate: '2024-10-01',
    eventType: 'baby',
    type: 'received',
    contactId: 'c-2',
    contactName: '李小花',
    contactRelation: '同事',
    amount: 1000,
    remark: '祝小宝宝健康成长',
    createdAt: '2026-08-10 11:30:00', // Yesterday
  },
  // 3. 最近记录 3: 张三丰 小明婚礼 +¥1,000 2024-01-15
  {
    id: 'r-3',
    eventId: 'e-2',
    eventTitle: '小明婚礼',
    eventDate: '2024-01-15',
    eventType: 'wedding',
    type: 'received',
    contactId: 'c-3',
    contactName: '张三丰',
    contactRelation: '合作伙伴',
    amount: 1000,
    remark: '祝新婚快乐，永结同心',
    createdAt: '2024-01-15 10:00:00',
  },
  // 4. 最近记录 4: 刘洋 刘洋生日宴 -¥500 2024-01-02
  {
    id: 'r-4',
    eventTitle: '刘洋生日宴',
    eventDate: '2024-01-02',
    eventType: 'birthday',
    type: 'given',
    contactId: 'c-4',
    contactName: '刘洋',
    contactRelation: '表哥',
    amount: 500,
    remark: '祝表哥生日快乐！',
    createdAt: '2024-01-02 18:00:00',
  },
  // 王大力 人情往来:
  // 他送我 2笔: 小明婚礼 ¥500 + 小明孩子满月宴 ¥1,000 = ¥1,500
  // 我送他 1笔: 王大力乔迁 ¥600
  // 差额: 他多送我 ¥900
  {
    id: 'r-5',
    eventId: 'e-2',
    eventTitle: '小明婚礼',
    eventDate: '2024-01-15',
    eventType: 'wedding',
    type: 'received',
    contactId: 'c-1',
    contactName: '王大力',
    contactRelation: '大学同学',
    amount: 500,
    remark: '铁哥们新婚大喜！',
    createdAt: '2024-01-15 09:30:00',
  },
  {
    id: 'r-6',
    eventId: 'e-1',
    eventTitle: '小明孩子满月宴',
    eventDate: '2024-10-01',
    eventType: 'baby',
    type: 'received',
    contactId: 'c-1',
    contactName: '王大力',
    contactRelation: '大学同学',
    amount: 1000,
    remark: '给干儿子的满月大红包',
    createdAt: '2024-10-01 10:30:00',
  },
  // 李小花: 他送我 ¥1,000 (满月宴 r-2), 我送他 ¥800 (李小花婚礼) => 总额 ¥1,800
  {
    id: 'r-7',
    eventTitle: '李小花婚礼',
    eventDate: '2024-05-20',
    eventType: 'wedding',
    type: 'given',
    contactId: 'c-2',
    contactName: '李小花',
    contactRelation: '同事',
    amount: 800,
    remark: '祝新婚幸福',
    createdAt: '2024-05-20 12:00:00',
  },
  // 张三丰: 他送我 ¥1,500 (小明婚礼 r-3 ¥1000 + 满月宴 ¥500), 我送他 ¥0 => 总额 ¥1,500
  {
    id: 'r-8',
    eventId: 'e-1',
    eventTitle: '小明孩子满月宴',
    eventDate: '2024-10-01',
    eventType: 'baby',
    type: 'received',
    contactId: 'c-3',
    contactName: '张三丰',
    contactRelation: '合作伙伴',
    amount: 500,
    remark: '祝宝宝健康',
    createdAt: '2024-10-01 11:00:00',
  },
  // 刘洋: 他送我 ¥700 (小明婚礼), 我送他 ¥500 (生日宴 r-4) => 总额 ¥1,200
  {
    id: 'r-9',
    eventId: 'e-2',
    eventTitle: '小明婚礼',
    eventDate: '2024-01-15',
    eventType: 'wedding',
    type: 'received',
    contactId: 'c-4',
    contactName: '刘洋',
    contactRelation: '表哥',
    amount: 700,
    remark: '新婚大喜',
    createdAt: '2024-01-15 10:10:00',
  },
  // 赵敏: 他送我 ¥1,000 (小明婚礼), 我送他 ¥0 => 总额 ¥1,000
  {
    id: 'r-10',
    eventId: 'e-2',
    eventTitle: '小明婚礼',
    eventDate: '2024-01-15',
    eventType: 'wedding',
    type: 'received',
    contactId: 'c-5',
    contactName: '赵敏',
    contactRelation: '闺蜜',
    amount: 1000,
    remark: '百年好合',
    createdAt: '2024-01-15 09:40:00',
  },

  // 补足总收入 ¥38,600 与 总支出 ¥22,400 (净额 +¥16,200) 以及 2024 各月柱状图走势
  // 1月: 收 ¥18,600 (小明婚礼), 送 ¥500 (刘洋生日)
  {
    id: 'r-11',
    eventId: 'e-2',
    eventTitle: '小明婚礼',
    eventDate: '2024-01-15',
    eventType: 'wedding',
    type: 'received',
    contactName: '亲戚长辈礼金群',
    contactRelation: '亲戚',
    amount: 15400, // 500+1000+700+1000+15400 = 18600
    remark: '婚礼其他亲朋礼金合计',
    createdAt: '2024-01-15 18:00:00',
  },
  // 2月: 收 ¥2,000, 送 ¥1,200 (张伯伯寿宴)
  {
    id: 'r-12',
    eventTitle: '二叔家新春团聚',
    eventDate: '2024-02-10',
    eventType: 'birthday',
    type: 'received',
    contactName: '二叔公',
    contactRelation: '长辈',
    amount: 2000,
    createdAt: '2024-02-10 12:00:00',
  },
  {
    id: 'r-13',
    eventTitle: '张伯伯七十大寿',
    eventDate: '2024-02-18',
    eventType: 'longevity',
    type: 'given',
    contactName: '张伯伯',
    contactRelation: '长辈',
    amount: 1200,
    remark: '福如东海，寿比南山',
    createdAt: '2024-02-18 10:00:00',
  },
  // 5月: 收 ¥6,000 (乔迁新居), 送 ¥800 (李小花婚礼)
  {
    id: 'r-14',
    eventId: 'e-4',
    eventTitle: '乔迁新居宴',
    eventDate: '2024-05-12',
    eventType: 'housewarming',
    type: 'received',
    contactName: '邻里好友',
    contactRelation: '朋友',
    amount: 6000,
    createdAt: '2024-05-12 18:00:00',
  },
  // 6月: 收 ¥0, 送 ¥600 (王大力乔迁 r-1)
  // 10月: 收 ¥12,000 (小明孩子满月宴: 1000+1000+500+9500 = 12000), 送 ¥1,500 (陈老师荣休宴)
  {
    id: 'r-15',
    eventId: 'e-1',
    eventTitle: '小明孩子满月宴',
    eventDate: '2024-10-01',
    eventType: 'baby',
    type: 'received',
    contactName: '满月宴其他宾客',
    contactRelation: '亲戚',
    amount: 9500,
    remark: '满月宴亲朋礼金合计',
    createdAt: '2024-10-01 18:00:00',
  },
  {
    id: 'r-16',
    eventTitle: '高中班主任荣休宴',
    eventDate: '2024-10-15',
    eventType: 'other',
    type: 'given',
    contactName: '陈老师',
    contactRelation: '长辈',
    amount: 1500,
    remark: '桃李满天下',
    createdAt: '2024-10-15 12:00:00',
  },
  // 往年支出余额以保证支出总额 ¥22,400 (500+800+1200+600+1500 = 4600 => + 17800 = 22400)
  {
    id: 'r-17',
    eventTitle: '历年亲友各项喜丧礼金往来',
    eventDate: '2023-11-20',
    eventType: 'wedding',
    type: 'given',
    contactName: '往年亲友往来',
    contactRelation: '亲戚',
    amount: 17800,
    remark: '往年各项礼金往来汇总',
    createdAt: '2023-11-20 00:00:00',
  },
];

export const useGiftStore = defineStore('giftStore', {
  state: () => ({
    userName: '小明',
    contacts: initialContacts as Contact[],
    events: initialEvents as EventItem[],
    records: initialRecords as GiftRecord[],
  }),
  getters: {
    totalIncome(state): number {
      return state.records
        .filter((r) => r.type === 'received')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    },
    totalExpense(state): number {
      return state.records
        .filter((r) => r.type === 'given')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    },
    netBalance(): number {
      return this.totalIncome - this.totalExpense;
    },
    recentRecords(state): GiftRecord[] {
      // Return top prominent recent records
      return [
        state.records.find((r) => r.id === 'r-1')!,
        state.records.find((r) => r.id === 'r-2')!,
        state.records.find((r) => r.id === 'r-3')!,
        state.records.find((r) => r.id === 'r-4')!,
      ].filter(Boolean);
    },
    myHostedEvents(state): EventItem[] {
      return state.events
        .filter((e) => e.isHostedByMe)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    attendedEvents(state): EventItem[] {
      return state.events
        .filter((e) => !e.isHostedByMe)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  },
  actions: {
    // 增加收礼记录
    addReceivedEventAndGifts(payload: {
      title: string;
      date: string;
      type: EventType;
      notes?: string;
      guests: { name: string; amount: number; relation?: RelationType }[];
    }) {
      const eventId = 'e-' + Date.now();
      const totalAmount = payload.guests.reduce((sum, g) => sum + Number(g.amount || 0), 0);

      const newEvent: EventItem = {
        id: eventId,
        title: payload.title,
        date: payload.date,
        type: payload.type,
        isHostedByMe: true,
        totalAmount,
        guestCount: payload.guests.length,
        notes: payload.notes || '',
      };
      this.events.unshift(newEvent);

      payload.guests.forEach((g, idx) => {
        let contact = this.contacts.find((c) => c.name === g.name);
        if (!contact && g.name.trim()) {
          contact = {
            id: 'c-' + (Date.now() + idx),
            name: g.name.trim(),
            relation: g.relation || '朋友',
            tag: g.relation || '朋友',
            createdAt: new Date().toISOString(),
          };
          this.contacts.push(contact);
        }

        const record: GiftRecord = {
          id: 'r-' + (Date.now() + idx),
          eventId,
          eventTitle: payload.title,
          eventDate: payload.date,
          eventType: payload.type,
          type: 'received',
          contactId: contact?.id,
          contactName: g.name.trim(),
          contactRelation: contact?.relation || g.relation || '朋友',
          amount: Number(g.amount),
          remark: '',
          createdAt: new Date().toISOString(),
        };
        this.records.unshift(record);
      });
    },

    // 增加单条送礼记录
    addGivenRecord(payload: {
      contactName: string;
      eventTitle: string;
      date: string;
      type: EventType;
      amount: number;
      remark?: string;
      relation?: RelationType;
    }) {
      let contact = this.contacts.find((c) => c.name === payload.contactName);
      if (!contact && payload.contactName.trim()) {
        contact = {
          id: 'c-' + Date.now(),
          name: payload.contactName.trim(),
          relation: payload.relation || '朋友',
          tag: payload.relation || '朋友',
          createdAt: new Date().toISOString(),
        };
        this.contacts.push(contact);
      }

      const eventId = 'e-' + Date.now();
      const newEvent: EventItem = {
        id: eventId,
        title: payload.eventTitle,
        date: payload.date,
        type: payload.type,
        isHostedByMe: false,
        totalAmount: Number(payload.amount),
        targetContactName: payload.contactName.trim(),
        notes: payload.remark || '',
      };
      this.events.unshift(newEvent);

      const record: GiftRecord = {
        id: 'r-' + Date.now(),
        eventId,
        eventTitle: payload.eventTitle,
        eventDate: payload.date,
        eventType: payload.type,
        type: 'given',
        contactId: contact?.id,
        contactName: payload.contactName.trim(),
        contactRelation: contact?.relation || payload.relation || '朋友',
        amount: Number(payload.amount),
        remark: payload.remark || '',
        createdAt: new Date().toISOString(),
      };
      this.records.unshift(record);
    },

    // 删除单条记录
    deleteRecord(recordId: string) {
      const idx = this.records.findIndex((r) => r.id === recordId);
      if (idx !== -1) {
        this.records.splice(idx, 1);
      }
    },

    // 获取特定联系人的人情对账明细
    getContactDetail(contactIdentifier: string) {
      const contact = this.contacts.find(
        (c) => c.id === contactIdentifier || c.name === contactIdentifier
      );
      const name = contact ? contact.name : contactIdentifier;

      const records = this.records
        .filter((r) => r.contactName === name || (contact && r.contactId === contact.id))
        .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

      const receivedList = records.filter((r) => r.type === 'received');
      const givenList = records.filter((r) => r.type === 'given');

      const totalReceived = receivedList.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const totalGiven = givenList.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const diff = totalReceived - totalGiven;

      let balanceBadge = '往来平衡';
      if (diff > 0) {
        balanceBadge = `他多送我 ¥${diff.toLocaleString()}`;
      } else if (diff < 0) {
        balanceBadge = `我多送他 ¥${Math.abs(diff).toLocaleString()}`;
      }

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

    // 获取按人情往来总额排名的排行榜（过滤掉汇总项）
    getTopExchangedContacts(limit = 5) {
      const allowedNames = ['王大力', '李小花', '张三丰', '刘洋', '赵敏'];
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

      this.records.forEach((r) => {
        if (!r.contactName || !allowedNames.includes(r.contactName)) return;
        const entry = statsMap.get(r.contactName) || {
          name: r.contactName,
          contact: this.contacts.find((c) => c.name === r.contactName),
          relation: r.contactRelation || '朋友',
          tag: r.contactRelation || '朋友',
          received: 0,
          given: 0,
          total: 0,
        };
        if (entry.contact && entry.contact.tag) {
          entry.tag = entry.contact.tag.replace('常来往宾客 · ', '');
        }
        if (r.type === 'received') {
          entry.received += Number(r.amount);
        } else {
          entry.given += Number(r.amount);
        }
        entry.total = entry.received + entry.given;
        statsMap.set(r.contactName, entry);
      });

      return Array.from(statsMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
    },

    // 获取指定年份的月度收支走势数据
    getMonthlyStats(year: number) {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthLabel: `${i + 1}月`,
        received: 0,
        given: 0,
      }));

      this.records.forEach((r) => {
        const date = new Date(r.eventDate || r.createdAt);
        if (date.getFullYear() === year) {
          const m = date.getMonth();
          if (m >= 0 && m < 12) {
            if (r.type === 'received') {
              months[m].received += Number(r.amount);
            } else {
              months[m].given += Number(r.amount);
            }
          }
        }
      });

      return months;
    },

    addContact(contact: Omit<Contact, 'id' | 'createdAt'>) {
      const newContact: Contact = {
        ...contact,
        id: 'c-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      this.contacts.unshift(newContact);
      return newContact;
    },

    updateContact(id: string, updates: Partial<Contact>) {
      const c = this.contacts.find((item) => item.id === id);
      if (c) {
        Object.assign(c, updates);
      }
    },

    setUserName(name: string) {
      this.userName = name;
    },
  },
  persist: {
    key: 'gift_ledger_store_v2',
  },
});

export default useGiftStore;
