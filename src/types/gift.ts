export type EventType =
  | 'wedding' // 婚礼
  | 'baby' // 满月/百日
  | 'housewarming' // 乔迁
  | 'birthday' // 生日
  | 'longevity' // 寿宴
  | 'education' // 升学
  | 'funeral' // 丧事
  | 'other'; // 其他

export type RecordType = 'received' | 'given'; // received: 收礼, given: 送礼

export type PaymentMethod = 'cash' | 'wechat' | 'alipay' | 'custom';

export type RelationType = '亲戚' | '朋友' | '同学' | '同事' | '合作伙伴' | '长辈' | '其他';

export interface Contact {
  id: string;
  name: string;
  relation: RelationType;
  tag?: string; // 如 "大学同学", "高中同学", "研发部同事"
  avatarBg?: string;
  phone?: string;
  remark?: string;
  createdAt: string;
}

export interface GiftRecord {
  id: string;
  eventId?: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  type: RecordType; // received | given
  contactId?: string;
  contactName: string;
  contactRelation?: string;
  amount: number;
  paymentMethod?: PaymentMethod; // 兼容旧记录，未设置时按现金处理
  customPaymentMethod?: string;
  remark?: string;
  createdAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  type: EventType;
  isHostedByMe: boolean; // true: 我办的, false: 参加的
  totalAmount: number;
  guestCount?: number;
  targetContactName?: string; // 如果是参加的，对应的对方姓名
  records?: GiftRecord[];
  notes?: string;
}
