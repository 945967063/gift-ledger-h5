/**
 * 数据库种子文件 — 将前端 Mock 数据写入 SQLite
 * 运行方式: npm run seed
 * 注意: 会先清空再重新写入，仅用于初始化或重置演示数据
 */
import db from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

console.log('🌱 开始写入种子数据...');

// ── 清空现有数据 ────────────────────────────────────────────
db.exec(`
  DELETE FROM records;
  DELETE FROM events;
  DELETE FROM contacts;
  DELETE FROM users;
`);

// ── 创建默认用户 ────────────────────────────────────────────
const userId = uuid();
const passwordHash = bcrypt.hashSync('Dev123456', 10);
db.prepare('INSERT INTO users (id, name, phone, password_hash) VALUES (?, ?, ?, ?)').run(
  userId,
  '小明',
  '13800000001',
  passwordHash
);
console.log(`✅ 创建用户: 小明 (手机号: 13800000001, 密码: Dev123456)`);

// ── 联系人 ──────────────────────────────────────────────────
const contacts = [
  {
    id: uuid(),
    name: '王大力',
    relation: '同学',
    tag: '大学同学',
    phone: '13800138001',
    avatarBg: '#E6A23C',
    remark: '大学室友兼铁哥们',
  },
  {
    id: uuid(),
    name: '李小花',
    relation: '同事',
    tag: '同事',
    phone: '13800138002',
    avatarBg: '#67C23A',
    remark: '同组产品经理',
  },
  {
    id: uuid(),
    name: '张三丰',
    relation: '合作伙伴',
    tag: '合作伙伴',
    phone: '13800138003',
    avatarBg: '#409EFF',
    remark: '武当科技总经理',
  },
  {
    id: uuid(),
    name: '刘洋',
    relation: '亲戚',
    tag: '表哥',
    phone: '13800138004',
    avatarBg: '#F56C6C',
    remark: '大舅家表哥',
  },
  {
    id: uuid(),
    name: '赵敏',
    relation: '朋友',
    tag: '闺蜜',
    phone: '13800138005',
    avatarBg: '#909399',
    remark: '高中同桌',
  },
];

const insertContact = db.prepare(
  'INSERT INTO contacts (id, user_id, name, relation, tag, phone, remark, avatar_bg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const c of contacts) {
  insertContact.run(c.id, userId, c.name, c.relation, c.tag, c.phone, c.remark, c.avatarBg);
}
console.log(`✅ 写入 ${contacts.length} 位联系人`);

const contactMap = Object.fromEntries(contacts.map((c) => [c.name, c.id]));

// ── 事件 ────────────────────────────────────────────────────
const e1 = uuid(),
  e2 = uuid(),
  e3 = uuid(),
  e4 = uuid();
const events = [
  {
    id: e1,
    title: '小明孩子满月宴',
    date: '2024-10-01',
    type: 'baby',
    isHosted: 1,
    totalAmount: 12000,
    guestCount: 25,
    notes: '在江南大酒店举办百日宴',
  },
  {
    id: e2,
    title: '小明婚礼',
    date: '2024-01-15',
    type: 'wedding',
    isHosted: 1,
    totalAmount: 18600,
    guestCount: 32,
    notes: '香格里拉大酒店喜宴',
  },
  {
    id: e3,
    title: '王大力乔迁宴',
    date: '2024-06-18',
    type: 'housewarming',
    isHosted: 0,
    totalAmount: 600,
    targetContact: '王大力',
    notes: '王大力万科新房入伙',
  },
  {
    id: e4,
    title: '乔迁新居宴',
    date: '2023-05-12',
    type: 'housewarming',
    isHosted: 1,
    totalAmount: 8000,
    guestCount: 15,
    notes: '幸福花园新家暖房',
  },
];

const insertEvent = db.prepare(
  'INSERT INTO events (id, user_id, title, date, type, is_hosted_by_me, total_amount, guest_count, target_contact_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const e of events) {
  insertEvent.run(
    e.id,
    userId,
    e.title,
    e.date,
    e.type,
    e.isHosted,
    e.totalAmount,
    (e as any).guestCount || null,
    (e as any).targetContact || null,
    e.notes
  );
}
console.log(`✅ 写入 ${events.length} 个事件`);

// ── 礼金记录 ────────────────────────────────────────────────
const insertRecord = db.prepare(
  `INSERT INTO records (id, user_id, event_id, event_title, event_date, event_type, type, contact_id, contact_name, contact_relation, amount, remark, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const records = [
  [
    uuid(),
    userId,
    e3,
    '王大力乔迁宴',
    '2024-06-18',
    'housewarming',
    'given',
    contactMap['王大力'],
    '王大力',
    '大学同学',
    600,
    '恭喜乔迁新居！',
    '2026-08-11 12:00:00',
  ],
  [
    uuid(),
    userId,
    e1,
    '小明孩子满月宴',
    '2024-10-01',
    'baby',
    'received',
    contactMap['李小花'],
    '李小花',
    '同事',
    1000,
    '祝小宝宝健康成长',
    '2026-08-10 11:30:00',
  ],
  [
    uuid(),
    userId,
    e2,
    '小明婚礼',
    '2024-01-15',
    'wedding',
    'received',
    contactMap['张三丰'],
    '张三丰',
    '合作伙伴',
    1000,
    '祝新婚快乐，永结同心',
    '2024-01-15 10:00:00',
  ],
  [
    uuid(),
    userId,
    null,
    '刘洋生日宴',
    '2024-01-02',
    'birthday',
    'given',
    contactMap['刘洋'],
    '刘洋',
    '表哥',
    500,
    '祝表哥生日快乐！',
    '2024-01-02 18:00:00',
  ],
  // 王大力往来
  [
    uuid(),
    userId,
    e2,
    '小明婚礼',
    '2024-01-15',
    'wedding',
    'received',
    contactMap['王大力'],
    '王大力',
    '大学同学',
    500,
    '铁哥们新婚大喜！',
    '2024-01-15 09:30:00',
  ],
  [
    uuid(),
    userId,
    e1,
    '小明孩子满月宴',
    '2024-10-01',
    'baby',
    'received',
    contactMap['王大力'],
    '王大力',
    '大学同学',
    1000,
    '给干儿子的满月大红包',
    '2024-10-01 10:30:00',
  ],
  // 李小花
  [
    uuid(),
    userId,
    null,
    '李小花婚礼',
    '2024-05-20',
    'wedding',
    'given',
    contactMap['李小花'],
    '李小花',
    '同事',
    800,
    '祝新婚幸福',
    '2024-05-20 12:00:00',
  ],
  // 张三丰
  [
    uuid(),
    userId,
    e1,
    '小明孩子满月宴',
    '2024-10-01',
    'baby',
    'received',
    contactMap['张三丰'],
    '张三丰',
    '合作伙伴',
    500,
    '祝宝宝健康',
    '2024-10-01 11:00:00',
  ],
  // 刘洋
  [
    uuid(),
    userId,
    e2,
    '小明婚礼',
    '2024-01-15',
    'wedding',
    'received',
    contactMap['刘洋'],
    '刘洋',
    '表哥',
    700,
    '新婚大喜',
    '2024-01-15 10:10:00',
  ],
  // 赵敏
  [
    uuid(),
    userId,
    e2,
    '小明婚礼',
    '2024-01-15',
    'wedding',
    'received',
    contactMap['赵敏'],
    '赵敏',
    '闺蜜',
    1000,
    '百年好合',
    '2024-01-15 09:40:00',
  ],
  // 批量补充婚礼数据
  [
    uuid(),
    userId,
    e2,
    '小明婚礼',
    '2024-01-15',
    'wedding',
    'received',
    null,
    '亲戚长辈礼金群',
    '亲戚',
    15400,
    '婚礼其他亲朋礼金合计',
    '2024-01-15 18:00:00',
  ],
  // 2月
  [
    uuid(),
    userId,
    null,
    '二叔家新春团聚',
    '2024-02-10',
    'birthday',
    'received',
    null,
    '二叔公',
    '长辈',
    2000,
    null,
    '2024-02-10 12:00:00',
  ],
  [
    uuid(),
    userId,
    null,
    '张伯伯七十大寿',
    '2024-02-18',
    'longevity',
    'given',
    null,
    '张伯伯',
    '长辈',
    1200,
    '福如东海，寿比南山',
    '2024-02-18 10:00:00',
  ],
  // 5月
  [
    uuid(),
    userId,
    e4,
    '乔迁新居宴',
    '2024-05-12',
    'housewarming',
    'received',
    null,
    '邻里好友',
    '朋友',
    6000,
    null,
    '2024-05-12 18:00:00',
  ],
  // 10月
  [
    uuid(),
    userId,
    e1,
    '小明孩子满月宴',
    '2024-10-01',
    'baby',
    'received',
    null,
    '满月宴其他宾客',
    '亲戚',
    9500,
    '满月宴亲朋礼金合计',
    '2024-10-01 18:00:00',
  ],
  [
    uuid(),
    userId,
    null,
    '高中班主任荣休宴',
    '2024-10-15',
    'other',
    'given',
    null,
    '陈老师',
    '长辈',
    1500,
    '桃李满天下',
    '2024-10-15 12:00:00',
  ],
  // 往年
  [
    uuid(),
    userId,
    null,
    '历年亲友各项喜丧礼金往来',
    '2023-11-20',
    'wedding',
    'given',
    null,
    '往年亲友往来',
    '亲戚',
    17800,
    '往年各项礼金往来汇总',
    '2023-11-20 00:00:00',
  ],
];

const insertAll = db.transaction(() => {
  for (const r of records) insertRecord.run(...r);
});
insertAll();
console.log(`✅ 写入 ${records.length} 条礼金记录`);

console.log('🎉 种子数据写入完成！');
console.log('📱 默认账号: 手机号 13800000001 / 密码 Dev123456');
