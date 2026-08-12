import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { recalculateEvent } from '../audit';
import {
  EVENT_TYPES,
  normalizeDate,
  PAYMENT_METHODS,
  RECORD_TYPES,
  RELATION_TYPES,
} from '../validation';

export const BACKUP_FORMAT = 'gift-ledger-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const MAX_ITEMS = 50_000;
const OPERATION_ACTIONS = new Set([
  'event_created',
  'event_updated',
  'event_deleted',
  'record_created',
  'record_updated',
  'record_deleted',
  'contact_created',
  'contact_updated',
  'contact_deleted',
]);
const ENTITY_TYPES = new Set(['event', 'record', 'contact']);

type NullableString = string | null;

export interface BackupContact {
  sourceId: string;
  name: string;
  relation: string;
  tag: NullableString;
  phone: NullableString;
  remark: NullableString;
  avatarBg: NullableString;
  createdAt: string;
}

export interface BackupEvent {
  sourceId: string;
  title: string;
  date: string;
  type: string;
  isHostedByMe: boolean;
  notes: NullableString;
  createdAt: string;
}

export interface BackupRecord {
  sourceId: string;
  eventSourceId: NullableString;
  contactSourceId: NullableString;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  type: string;
  contactName: string;
  contactRelation: NullableString;
  amount: number;
  paymentMethod: string;
  customPaymentMethod: NullableString;
  remark: NullableString;
  createdAt: string;
}

export interface BackupOperationLog {
  sourceId: string;
  eventSourceId: NullableString;
  recordSourceId: NullableString;
  action: string;
  entityType: string;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface BackupSummary {
  contacts: number;
  events: number;
  records: number;
  operationLogs: number;
}

export interface GiftLedgerBackup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  account: {
    name: string;
  };
  summary: BackupSummary;
  data: {
    contacts: BackupContact[];
    events: BackupEvent[];
    records: BackupRecord[];
    operationLogs: BackupOperationLog[];
  };
}

export class BackupValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== 'string') throw new BackupValidationError(`${field} 格式不正确`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BackupValidationError(`${field} 为空或超出 ${maxLength} 个字符`);
  }
  return normalized;
};

const nullableString = (value: unknown, field: string, maxLength: number): NullableString => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new BackupValidationError(`${field} 格式不正确或超出 ${maxLength} 个字符`);
  }
  return value.trim() || null;
};

const requiredDate = (value: unknown, field: string): string => {
  const date = requiredString(value, field, 10);
  if (!normalizeDate(date)) {
    throw new BackupValidationError(`${field} 日期格式不正确`);
  }
  return date;
};

const requiredTimestamp = (value: unknown, field: string): string => {
  const timestamp = requiredString(value, field, 40);
  if (Number.isNaN(Date.parse(timestamp.replace(' ', 'T')))) {
    throw new BackupValidationError(`${field} 时间格式不正确`);
  }
  return timestamp;
};

const requiredArray = (value: unknown, field: string): unknown[] => {
  if (!Array.isArray(value)) throw new BackupValidationError(`${field} 必须是数组`);
  if (value.length > MAX_ITEMS) {
    throw new BackupValidationError(`${field} 数量超过 ${MAX_ITEMS} 条限制`);
  }
  return value;
};

const assertUniqueSourceIds = (items: { sourceId: string }[], field: string) => {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.sourceId)) throw new BackupValidationError(`${field} 存在重复 ID`);
    ids.add(item.sourceId);
  }
};

const normalizeDetails = (value: unknown, field: string): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw new BackupValidationError(`${field} 必须是对象或 null`);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 100_000) {
    throw new BackupValidationError(`${field} 内容过大`);
  }
  return sanitizeBackupDetails(value) as Record<string, unknown>;
};

const SENSITIVE_DETAIL_KEYS = new Set(['user_id', 'userId', 'password_hash', 'passwordHash']);
const sanitizeBackupDetails = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeBackupDetails);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_DETAIL_KEYS.has(key))
      .map(([key, nestedValue]) => [key, sanitizeBackupDetails(nestedValue)])
  );
};

const normalizeContact = (value: unknown, index: number): BackupContact => {
  if (!isObject(value)) throw new BackupValidationError(`contacts[${index}] 格式不正确`);
  const relation = requiredString(value.relation, `contacts[${index}].relation`, 20);
  if (!RELATION_TYPES.has(relation)) {
    throw new BackupValidationError(`contacts[${index}].relation 不受支持`);
  }
  return {
    sourceId: requiredString(value.sourceId, `contacts[${index}].sourceId`, 100),
    name: requiredString(value.name, `contacts[${index}].name`, 30),
    relation,
    tag: nullableString(value.tag, `contacts[${index}].tag`, 30),
    phone: nullableString(value.phone, `contacts[${index}].phone`, 30),
    remark: nullableString(value.remark, `contacts[${index}].remark`, 200),
    avatarBg: nullableString(value.avatarBg, `contacts[${index}].avatarBg`, 30),
    createdAt: requiredTimestamp(value.createdAt, `contacts[${index}].createdAt`),
  };
};

const normalizeEvent = (value: unknown, index: number): BackupEvent => {
  if (!isObject(value)) throw new BackupValidationError(`events[${index}] 格式不正确`);
  const type = requiredString(value.type, `events[${index}].type`, 30);
  if (!EVENT_TYPES.has(type)) throw new BackupValidationError(`events[${index}].type 不受支持`);
  if (typeof value.isHostedByMe !== 'boolean') {
    throw new BackupValidationError(`events[${index}].isHostedByMe 必须是布尔值`);
  }
  return {
    sourceId: requiredString(value.sourceId, `events[${index}].sourceId`, 100),
    title: requiredString(value.title, `events[${index}].title`, 60),
    date: requiredDate(value.date, `events[${index}].date`),
    type,
    isHostedByMe: value.isHostedByMe,
    notes: nullableString(value.notes, `events[${index}].notes`, 500),
    createdAt: requiredTimestamp(value.createdAt, `events[${index}].createdAt`),
  };
};

const normalizeRecord = (value: unknown, index: number): BackupRecord => {
  if (!isObject(value)) throw new BackupValidationError(`records[${index}] 格式不正确`);
  const type = requiredString(value.type, `records[${index}].type`, 20);
  const eventType = requiredString(value.eventType, `records[${index}].eventType`, 30);
  const paymentMethod = requiredString(value.paymentMethod, `records[${index}].paymentMethod`, 20);
  const amount = Number(value.amount);
  const customPaymentMethod = nullableString(
    value.customPaymentMethod,
    `records[${index}].customPaymentMethod`,
    20
  );
  if (!RECORD_TYPES.has(type)) throw new BackupValidationError(`records[${index}].type 不受支持`);
  if (!EVENT_TYPES.has(eventType)) {
    throw new BackupValidationError(`records[${index}].eventType 不受支持`);
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new BackupValidationError(`records[${index}].paymentMethod 不受支持`);
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    throw new BackupValidationError(`records[${index}].amount 金额不合法`);
  }
  if (paymentMethod === 'custom' && !customPaymentMethod) {
    throw new BackupValidationError(`records[${index}] 缺少自定义支付方式名称`);
  }
  const contactRelation = nullableString(
    value.contactRelation,
    `records[${index}].contactRelation`,
    20
  );
  if (contactRelation && !RELATION_TYPES.has(contactRelation)) {
    throw new BackupValidationError(`records[${index}].contactRelation 不受支持`);
  }
  return {
    sourceId: requiredString(value.sourceId, `records[${index}].sourceId`, 100),
    eventSourceId: nullableString(value.eventSourceId, `records[${index}].eventSourceId`, 100),
    contactSourceId: nullableString(
      value.contactSourceId,
      `records[${index}].contactSourceId`,
      100
    ),
    eventTitle: requiredString(value.eventTitle, `records[${index}].eventTitle`, 60),
    eventDate: requiredDate(value.eventDate, `records[${index}].eventDate`),
    eventType,
    type,
    contactName: requiredString(value.contactName, `records[${index}].contactName`, 30),
    contactRelation,
    amount: Math.round(amount * 100) / 100,
    paymentMethod,
    customPaymentMethod: paymentMethod === 'custom' ? customPaymentMethod : null,
    remark: nullableString(value.remark, `records[${index}].remark`, 200),
    createdAt: requiredTimestamp(value.createdAt, `records[${index}].createdAt`),
  };
};

const normalizeOperationLog = (value: unknown, index: number): BackupOperationLog => {
  if (!isObject(value)) {
    throw new BackupValidationError(`operationLogs[${index}] 格式不正确`);
  }
  const action = requiredString(value.action, `operationLogs[${index}].action`, 50);
  const entityType = requiredString(value.entityType, `operationLogs[${index}].entityType`, 20);
  if (!OPERATION_ACTIONS.has(action)) {
    throw new BackupValidationError(`operationLogs[${index}].action 不受支持`);
  }
  if (!ENTITY_TYPES.has(entityType)) {
    throw new BackupValidationError(`operationLogs[${index}].entityType 不受支持`);
  }
  return {
    sourceId: requiredString(value.sourceId, `operationLogs[${index}].sourceId`, 100),
    eventSourceId: nullableString(
      value.eventSourceId,
      `operationLogs[${index}].eventSourceId`,
      100
    ),
    recordSourceId: nullableString(
      value.recordSourceId,
      `operationLogs[${index}].recordSourceId`,
      100
    ),
    action,
    entityType,
    summary: requiredString(value.summary, `operationLogs[${index}].summary`, 500),
    details: normalizeDetails(value.details, `operationLogs[${index}].details`),
    createdAt: requiredTimestamp(value.createdAt, `operationLogs[${index}].createdAt`),
  };
};

export const parseBackup = (value: unknown): GiftLedgerBackup => {
  if (!isObject(value)) throw new BackupValidationError('备份文件根节点格式不正确');
  if (value.format !== BACKUP_FORMAT) throw new BackupValidationError('不是有效的人情簿备份文件');
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError(`暂不支持备份版本 ${String(value.schemaVersion)}`);
  }
  if (!isObject(value.account)) throw new BackupValidationError('account 格式不正确');
  if (!isObject(value.data)) throw new BackupValidationError('data 格式不正确');

  const contacts = requiredArray(value.data.contacts, 'data.contacts').map(normalizeContact);
  const events = requiredArray(value.data.events, 'data.events').map(normalizeEvent);
  const records = requiredArray(value.data.records, 'data.records').map(normalizeRecord);
  const operationLogs = requiredArray(value.data.operationLogs, 'data.operationLogs').map(
    normalizeOperationLog
  );
  assertUniqueSourceIds(contacts, 'data.contacts');
  assertUniqueSourceIds(events, 'data.events');
  assertUniqueSourceIds(records, 'data.records');
  assertUniqueSourceIds(operationLogs, 'data.operationLogs');

  const contactIds = new Set(contacts.map((item) => item.sourceId));
  const eventIds = new Set(events.map((item) => item.sourceId));
  const contactNames = new Set<string>();
  for (const contact of contacts) {
    if (contactNames.has(contact.name)) {
      throw new BackupValidationError(`联系人“${contact.name}”重复`);
    }
    contactNames.add(contact.name);
  }
  for (const [index, record] of records.entries()) {
    if (record.contactSourceId && !contactIds.has(record.contactSourceId)) {
      throw new BackupValidationError(`records[${index}] 引用了不存在的联系人`);
    }
    if (record.eventSourceId && !eventIds.has(record.eventSourceId)) {
      throw new BackupValidationError(`records[${index}] 引用了不存在的事件`);
    }
    if (record.eventSourceId) {
      const event = events.find((item) => item.sourceId === record.eventSourceId)!;
      const expectedType = event.isHostedByMe ? 'received' : 'given';
      if (record.type !== expectedType) {
        throw new BackupValidationError(`records[${index}] 收送礼类型与关联事件不一致`);
      }
    }
  }

  const normalized: GiftLedgerBackup = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: requiredTimestamp(value.exportedAt, 'exportedAt'),
    appVersion: requiredString(value.appVersion, 'appVersion', 50),
    account: { name: requiredString(value.account.name, 'account.name', 30) },
    summary: {
      contacts: contacts.length,
      events: events.length,
      records: records.length,
      operationLogs: operationLogs.length,
    },
    data: { contacts, events, records, operationLogs },
  };
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_BACKUP_BYTES) {
    throw new BackupValidationError('备份内容超过 10MB 限制');
  }
  return normalized;
};

const parseStoredDetails = (details: unknown): Record<string, unknown> | null => {
  if (typeof details !== 'string' || !details) return null;
  try {
    const parsed = JSON.parse(details) as unknown;
    return isObject(parsed) ? (sanitizeBackupDetails(parsed) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

type DbRow = Record<string, unknown>;
const asNullableString = (value: unknown): NullableString =>
  value === null || value === undefined || value === '' ? null : String(value);

export const createUserBackup = (userId: string): GiftLedgerBackup => {
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as
    | { name: string }
    | undefined;
  if (!user) throw new BackupValidationError('用户不存在');

  const contacts = (
    db
      .prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at ASC, id ASC')
      .all(userId) as DbRow[]
  ).map<BackupContact>((row) => ({
    sourceId: String(row.id),
    name: String(row.name),
    relation: String(row.relation),
    tag: asNullableString(row.tag),
    phone: asNullableString(row.phone),
    remark: asNullableString(row.remark),
    avatarBg: asNullableString(row.avatar_bg),
    createdAt: String(row.created_at),
  }));
  const events = (
    db
      .prepare('SELECT * FROM events WHERE user_id = ? ORDER BY created_at ASC, id ASC')
      .all(userId) as DbRow[]
  ).map<BackupEvent>((row) => ({
    sourceId: String(row.id),
    title: String(row.title),
    date: String(row.date),
    type: String(row.type),
    isHostedByMe: Boolean(row.is_hosted_by_me),
    notes: asNullableString(row.notes),
    createdAt: String(row.created_at),
  }));
  const records = (
    db
      .prepare('SELECT * FROM records WHERE user_id = ? ORDER BY created_at ASC, id ASC')
      .all(userId) as DbRow[]
  ).map<BackupRecord>((row) => ({
    sourceId: String(row.id),
    eventSourceId: asNullableString(row.event_id),
    contactSourceId: asNullableString(row.contact_id),
    eventTitle: String(row.event_title),
    eventDate: String(row.event_date),
    eventType: String(row.event_type),
    type: String(row.type),
    contactName: String(row.contact_name),
    contactRelation: asNullableString(row.contact_relation),
    amount: Number(row.amount),
    paymentMethod: String(row.payment_method || 'cash'),
    customPaymentMethod: asNullableString(row.custom_payment_method),
    remark: asNullableString(row.remark),
    createdAt: String(row.created_at),
  }));
  const operationLogs = (
    db
      .prepare('SELECT * FROM operation_logs WHERE user_id = ? ORDER BY created_at ASC, id ASC')
      .all(userId) as DbRow[]
  ).map<BackupOperationLog>((row) => ({
    sourceId: String(row.id),
    eventSourceId: asNullableString(row.event_id),
    recordSourceId: asNullableString(row.record_id),
    action: String(row.action),
    entityType: String(row.entity_type),
    summary: String(row.summary),
    details: parseStoredDetails(row.details),
    createdAt: String(row.created_at),
  }));

  const backup: GiftLedgerBackup = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: process.env.APP_VERSION || '1.0.0',
    account: { name: user.name },
    summary: {
      contacts: contacts.length,
      events: events.length,
      records: records.length,
      operationLogs: operationLogs.length,
    },
    data: { contacts, events, records, operationLogs },
  };
  if (Buffer.byteLength(JSON.stringify(backup), 'utf8') > MAX_BACKUP_BYTES) {
    throw new BackupValidationError('当前账号数据超过 10MB，暂时无法通过页面导出');
  }
  return backup;
};

export const getBackupChecksum = (backup: GiftLedgerBackup): string =>
  createHash('sha256').update(JSON.stringify(backup)).digest('hex');

export const replaceUserDataFromBackup = (
  userId: string,
  backup: GiftLedgerBackup
): BackupSummary => {
  const contactIdMap = new Map(backup.data.contacts.map((item) => [item.sourceId, uuid()]));
  const eventIdMap = new Map(backup.data.events.map((item) => [item.sourceId, uuid()]));
  const recordIdMap = new Map(backup.data.records.map((item) => [item.sourceId, uuid()]));
  const eventBySourceId = new Map(backup.data.events.map((item) => [item.sourceId, item]));
  const contactBySourceId = new Map(backup.data.contacts.map((item) => [item.sourceId, item]));
  const orphanEventIdMap = new Map<string, string>();
  const orphanRecordIdMap = new Map<string, string>();
  const mapLogReference = (
    sourceId: NullableString,
    knownIds: Map<string, string>,
    orphanIds: Map<string, string>
  ) => {
    if (!sourceId) return null;
    const known = knownIds.get(sourceId);
    if (known) return known;
    const existing = orphanIds.get(sourceId);
    if (existing) return existing;
    const generated = uuid();
    orphanIds.set(sourceId, generated);
    return generated;
  };

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM operation_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM records WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM contacts WHERE user_id = ?').run(userId);

    const insertContact = db.prepare(
      `INSERT INTO contacts
        (id, user_id, name, relation, tag, phone, remark, avatar_bg, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const contact of backup.data.contacts) {
      insertContact.run(
        contactIdMap.get(contact.sourceId),
        userId,
        contact.name,
        contact.relation,
        contact.tag,
        contact.phone,
        contact.remark,
        contact.avatarBg,
        contact.createdAt
      );
    }

    const insertEvent = db.prepare(
      `INSERT INTO events
        (id, user_id, title, date, type, is_hosted_by_me, total_amount, guest_count,
         target_contact_name, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)`
    );
    for (const event of backup.data.events) {
      insertEvent.run(
        eventIdMap.get(event.sourceId),
        userId,
        event.title,
        event.date,
        event.type,
        event.isHostedByMe ? 1 : 0,
        event.notes,
        event.createdAt
      );
    }

    const insertRecord = db.prepare(
      `INSERT INTO records
        (id, user_id, event_id, event_title, event_date, event_type, type, contact_id,
         contact_name, contact_relation, amount, payment_method, custom_payment_method,
         remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const record of backup.data.records) {
      const event = record.eventSourceId ? eventBySourceId.get(record.eventSourceId) : undefined;
      const contact = record.contactSourceId
        ? contactBySourceId.get(record.contactSourceId)
        : undefined;
      insertRecord.run(
        recordIdMap.get(record.sourceId),
        userId,
        record.eventSourceId ? eventIdMap.get(record.eventSourceId) : null,
        event?.title || record.eventTitle,
        event?.date || record.eventDate,
        event?.type || record.eventType,
        record.type,
        record.contactSourceId ? contactIdMap.get(record.contactSourceId) : null,
        contact?.name || record.contactName,
        contact?.relation || record.contactRelation,
        record.amount,
        record.paymentMethod,
        record.customPaymentMethod,
        record.remark,
        record.createdAt
      );
    }

    for (const eventId of eventIdMap.values()) recalculateEvent(eventId, userId);

    const insertLog = db.prepare(
      `INSERT INTO operation_logs
        (id, user_id, event_id, record_id, action, entity_type, summary, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const log of backup.data.operationLogs) {
      insertLog.run(
        uuid(),
        userId,
        mapLogReference(log.eventSourceId, eventIdMap, orphanEventIdMap),
        mapLogReference(log.recordSourceId, recordIdMap, orphanRecordIdMap),
        log.action,
        log.entityType,
        log.summary,
        log.details ? JSON.stringify(log.details) : null,
        log.createdAt
      );
    }
  });
  replace();
  return backup.summary;
};
