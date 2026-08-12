const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const NodeSqliteAdapter = require('./node-sqlite-adapter');

const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-ledger-api-'));
process.env.NODE_ENV = 'test';
process.env.DB_DIR = testDbDir;
process.env.JWT_SECRET = 'gift-ledger-test-secret-with-more-than-32-characters';
process.env.AUTH_RATE_LIMIT = '1000';

// Windows 本地环境可能没有 better-sqlite3 的原生编译工具；测试使用 Node 24
// 内置 SQLite 的同步适配器，生产代码和 Docker 镜像仍使用 better-sqlite3。
const originalModuleLoad = Module._load;
Module._load = function loadWithTestSqlite(request, parent, isMain) {
  if (request === 'better-sqlite3') return NodeSqliteAdapter;
  return originalModuleLoad.call(this, request, parent, isMain);
};
const app = require('../dist/app').default;
const db = require('../dist/db').default;
Module._load = originalModuleLoad;

let server;
let baseUrl;
let token;
let secondToken;
let receivedEventId;

const request = async (url, options = {}) => {
  const response = await fetch(`${baseUrl}${url}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { response, body };
};

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  fs.rmSync(testDbDir, { recursive: true, force: true });
});

test('健康检查可用且隐藏 Express 标识', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.code, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    response.headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()'
  );
});

test('非法 JSON 请求返回 400 而非服务器错误', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid-json',
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.code, 400);
});

test('注册校验手机号和密码强度', async () => {
  const invalidPhone = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '测试用户', phone: '123', password: '12345678' },
  });
  assert.equal(invalidPhone.response.status, 400);

  const weakPassword = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '测试用户', phone: '13900001001', password: '123' },
  });
  assert.equal(weakPassword.response.status, 400);
});

test('注册、重复注册、登录与错误密码', async () => {
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '主测试用户', phone: '13900001001', password: 'Test123456' },
  });
  assert.equal(registration.response.status, 201);
  token = registration.body.data.token;
  assert.ok(token);

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '重复用户', phone: '13900001001', password: 'Test123456' },
  });
  assert.equal(duplicate.response.status, 409);

  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { phone: '13900001001', password: 'wrong-password' },
  });
  assert.equal(wrongPassword.response.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { phone: '13900001001', password: 'Test123456' },
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.body.data.token);
});

test('受保护接口拒绝匿名请求', async () => {
  const { response, body } = await request('/api/contacts');
  assert.equal(response.status, 401);
  assert.equal(body.code, 401);

  const backup = await request('/api/backups/export');
  assert.equal(backup.response.status, 401);
});

test('登录用户可以修改并重新读取账户昵称', async () => {
  const updated = await request('/api/auth/profile', {
    method: 'PUT',
    token,
    body: { name: '主测试用户（已修改）' },
  });
  assert.equal(updated.response.status, 200);

  const profile = await request('/api/auth/profile', { token });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.name, '主测试用户（已修改）');
});

test('联系人支持新增、去重、更新与清空选填字段', async () => {
  const created = await request('/api/contacts', {
    method: 'POST',
    token,
    body: {
      name: '王测试',
      relation: '同事',
      tag: '研发部',
      phone: '13800138000',
      remark: '自动化测试联系人',
    },
  });
  assert.equal(created.response.status, 201);
  const contactId = created.body.data.id;

  const duplicate = await request('/api/contacts', {
    method: 'POST',
    token,
    body: { name: '王测试', relation: '朋友' },
  });
  assert.equal(duplicate.response.status, 409);

  const updated = await request(`/api/contacts/${contactId}`, {
    method: 'PUT',
    token,
    body: { tag: '', remark: '' },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.tag, null);
  assert.equal(updated.body.data.remark, null);

  const removed = await request(`/api/contacts/${contactId}`, { method: 'DELETE', token });
  assert.equal(removed.response.status, 200);
  const contactsAfterDelete = await request('/api/contacts', { token });
  assert.ok(!contactsAfterDelete.body.data.some((item) => item.id === contactId));

  const logs = await request('/api/events/logs?limit=200', { token });
  assert.equal(logs.response.status, 200);
  const contactActions = logs.body.data
    .filter((log) => log.entity_type === 'contact')
    .map((log) => log.action);
  assert.ok(contactActions.includes('contact_created'));
  assert.ok(contactActions.includes('contact_updated'));
  assert.ok(contactActions.includes('contact_deleted'));
  const updateLog = logs.body.data.find((log) => log.action === 'contact_updated');
  const updateDetails = JSON.parse(updateLog.details);
  assert.equal(updateDetails.before.tag, '研发部');
  assert.equal(updateDetails.after.tag, null);
});

test('收礼事件拒绝无效金额和缺失的自定义支付名称', async () => {
  const zeroAmount = await request('/api/events', {
    method: 'POST',
    token,
    body: {
      title: '无效金额宴席',
      date: '2026-08-11',
      type: 'wedding',
      guests: [{ name: '无效宾客', amount: 0, paymentMethod: 'cash' }],
    },
  });
  assert.equal(zeroAmount.response.status, 400);

  const missingCustomName = await request('/api/events', {
    method: 'POST',
    token,
    body: {
      title: '无效支付方式宴席',
      date: '2026-08-11',
      type: 'wedding',
      guests: [{ name: '无效宾客', amount: 100, paymentMethod: 'custom' }],
    },
  });
  assert.equal(missingCustomName.response.status, 400);
});

test('收礼事件以事务写入事件、联系人和不同支付方式的明细', async () => {
  const created = await request('/api/events', {
    method: 'POST',
    token,
    body: {
      title: '自动化婚礼',
      date: '2026-08-11',
      type: 'wedding',
      notes: '后端集成测试',
      guests: [
        { name: '现金宾客', amount: 500, relation: '朋友', paymentMethod: 'cash' },
        {
          name: '转账宾客',
          amount: 888.88,
          relation: '同事',
          paymentMethod: 'custom',
          customPaymentMethod: '云闪付',
        },
      ],
    },
  });
  assert.equal(created.response.status, 201);
  receivedEventId = created.body.data.id;
  assert.equal(created.body.data.total_amount, 1388.88);
  assert.equal(created.body.data.guest_count, 2);

  const detail = await request(`/api/events/${receivedEventId}`, { token });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.records.length, 2);
  assert.deepEqual(
    new Set(detail.body.data.records.map((record) => record.payment_method)),
    new Set(['cash', 'custom'])
  );
  const customRecord = detail.body.data.records.find(
    (record) => record.payment_method === 'custom'
  );
  assert.equal(customRecord.custom_payment_method, '云闪付');
});

test('已保存事件可继续添加、修改和删除礼金，并完整记录操作日志', async () => {
  const added = await request('/api/records', {
    method: 'POST',
    token,
    body: {
      eventId: receivedEventId,
      type: 'received',
      contactName: '续记宾客',
      contactRelation: '朋友',
      amount: 300,
      paymentMethod: 'cash',
      remark: '后续补录',
    },
  });
  assert.equal(added.response.status, 201);
  const addedRecordId = added.body.data.id;

  const detailAfterAdd = await request(`/api/events/${receivedEventId}`, { token });
  assert.equal(detailAfterAdd.body.data.guest_count, 3);
  assert.equal(detailAfterAdd.body.data.total_amount, 1688.88);

  const updated = await request(`/api/records/${addedRecordId}`, {
    method: 'PUT',
    token,
    body: {
      contactName: '续记宾客（已修改）',
      contactRelation: '亲戚',
      amount: 666,
      paymentMethod: 'wechat',
      remark: '金额和关系已调整',
    },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.contact_name, '续记宾客（已修改）');
  assert.equal(updated.body.data.amount, 666);
  assert.equal(updated.body.data.payment_method, 'wechat');

  const detailAfterUpdate = await request(`/api/events/${receivedEventId}`, { token });
  assert.equal(detailAfterUpdate.body.data.guest_count, 3);
  assert.equal(detailAfterUpdate.body.data.total_amount, 2054.88);

  const removed = await request(`/api/records/${addedRecordId}`, {
    method: 'DELETE',
    token,
  });
  assert.equal(removed.response.status, 200);

  const detailAfterDelete = await request(`/api/events/${receivedEventId}`, { token });
  assert.equal(detailAfterDelete.body.data.guest_count, 2);
  assert.equal(detailAfterDelete.body.data.total_amount, 1388.88);

  const logs = await request(`/api/events/${receivedEventId}/logs`, { token });
  assert.equal(logs.response.status, 200);
  const actions = logs.body.data.map((log) => log.action);
  assert.ok(actions.includes('event_created'));
  assert.ok(actions.includes('record_created'));
  assert.ok(actions.includes('record_updated'));
  assert.ok(actions.includes('record_deleted'));
  const updateLog = logs.body.data.find((log) => log.action === 'record_updated');
  const updateDetails = JSON.parse(updateLog.details);
  assert.equal(updateDetails.before.amount, 300);
  assert.equal(updateDetails.after.amount, 666);
});

test('送礼记录默认现金并支持支付宝', async () => {
  const alipay = await request('/api/events/given', {
    method: 'POST',
    token,
    body: {
      contactName: '支付宝联系人',
      eventTitle: '乔迁宴',
      date: '2026-08-10',
      type: 'housewarming',
      amount: 600,
      relation: '朋友',
      paymentMethod: 'alipay',
    },
  });
  assert.equal(alipay.response.status, 201);

  const cash = await request('/api/events/given', {
    method: 'POST',
    token,
    body: {
      contactName: '现金联系人',
      eventTitle: '生日宴',
      date: '2026-08-09',
      type: 'birthday',
      amount: 200,
    },
  });
  assert.equal(cash.response.status, 201);

  const records = await request('/api/records?pageSize=500', { token });
  assert.equal(records.response.status, 200);
  const methods = new Map(
    records.body.data.records.map((record) => [record.contact_name, record.payment_method])
  );
  assert.equal(methods.get('支付宝联系人'), 'alipay');
  assert.equal(methods.get('现金联系人'), 'cash');
});

test('修改联系人会同步关联明细和送礼事件', async () => {
  const contacts = await request('/api/contacts', { token });
  const contact = contacts.body.data.find((item) => item.name === '支付宝联系人');
  assert.ok(contact);

  const updated = await request(`/api/contacts/${contact.id}`, {
    method: 'PUT',
    token,
    body: { name: '支付宝联系人（已改名）', relation: '同事' },
  });
  assert.equal(updated.response.status, 200);

  const records = await request('/api/records?pageSize=500', { token });
  const record = records.body.data.records.find((item) => item.contact_id === contact.id);
  assert.equal(record.contact_name, '支付宝联系人（已改名）');
  assert.equal(record.contact_relation, '同事');

  const events = await request('/api/events?hosted=false', { token });
  const event = events.body.data.find((item) => item.id === record.event_id);
  assert.equal(event.target_contact_name, '支付宝联系人（已改名）');
});

test('修改事件会同步明细中的冗余事件信息', async () => {
  const updated = await request(`/api/events/${receivedEventId}`, {
    method: 'PUT',
    token,
    body: { title: '自动化婚礼（已更新）', date: '2026-08-12', type: 'other' },
  });
  assert.equal(updated.response.status, 200);

  const detail = await request(`/api/events/${receivedEventId}`, { token });
  for (const record of detail.body.data.records) {
    assert.equal(record.event_title, '自动化婚礼（已更新）');
    assert.equal(record.event_date, '2026-08-12');
    assert.equal(record.event_type, 'other');
  }

  const logs = await request(`/api/events/${receivedEventId}/logs`, { token });
  assert.ok(logs.body.data.some((log) => log.action === 'event_updated'));
});

test('删除单条明细后重新计算事件总额和人数', async () => {
  const detailBefore = await request(`/api/events/${receivedEventId}`, { token });
  const deletedRecord = detailBefore.body.data.records.find((record) => record.amount === 500);
  assert.ok(deletedRecord);

  const removed = await request(`/api/records/${deletedRecord.id}`, {
    method: 'DELETE',
    token,
  });
  assert.equal(removed.response.status, 200);

  const detailAfter = await request(`/api/events/${receivedEventId}`, { token });
  assert.equal(detailAfter.body.data.guest_count, 1);
  assert.equal(detailAfter.body.data.total_amount, 888.88);
  assert.equal(detailAfter.body.data.records.length, 1);
});

test('删除事件时同时清理其礼金明细，避免形成孤立账目', async () => {
  const created = await request('/api/events', {
    method: 'POST',
    token,
    body: {
      title: '待删除测试事件',
      date: '2026-08-13',
      type: 'birthday',
      guests: [{ name: '待删除宾客', amount: 100, paymentMethod: 'cash' }],
    },
  });
  assert.equal(created.response.status, 201);
  const eventId = created.body.data.id;

  const removed = await request(`/api/events/${eventId}`, { method: 'DELETE', token });
  assert.equal(removed.response.status, 200);

  const events = await request('/api/events', { token });
  const records = await request('/api/records?pageSize=500', { token });
  assert.ok(!events.body.data.some((event) => event.id === eventId));
  assert.ok(!records.body.data.records.some((record) => record.event_id === eventId));

  const logs = await request('/api/events/logs?limit=200', { token });
  const deletedEventLogs = logs.body.data.filter((log) => log.event_id === eventId);
  assert.ok(deletedEventLogs.some((log) => log.action === 'event_deleted'));
  assert.ok(deletedEventLogs.some((log) => log.action === 'record_deleted'));
});

test('统计接口与分页边界返回稳定数据', async () => {
  const summary = await request('/api/stats/summary', { token });
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.data.totalIncome, 888.88);
  assert.equal(summary.body.data.totalExpense, 800);
  assert.equal(summary.body.data.netBalance, 88.88);

  const yearlySummary = await request('/api/stats/summary?year=2026', { token });
  assert.equal(yearlySummary.response.status, 200);
  assert.equal(yearlySummary.body.data.netBalance, 88.88);

  const years = await request('/api/stats/years', { token });
  assert.ok(years.body.data.includes(2026));

  const category = await request('/api/stats/category', { token });
  assert.equal(category.response.status, 200);
  assert.ok(category.body.data.every((item) => item.label && item.type));

  const paged = await request('/api/records?page=0&pageSize=99999', { token });
  assert.equal(paged.response.status, 200);
  assert.equal(paged.body.data.page, 1);
  assert.equal(paged.body.data.pageSize, 500);

  const recordsPage1 = await request('/api/records?page=1&pageSize=1', { token });
  const recordsPage2 = await request('/api/records?page=2&pageSize=1', { token });
  assert.equal(recordsPage1.body.data.records.length, 1);
  assert.equal(recordsPage1.body.data.hasMore, true);
  assert.notEqual(recordsPage1.body.data.records[0].id, recordsPage2.body.data.records[0].id);

  const contactsPage = await request('/api/contacts?page=1&pageSize=1', { token });
  assert.equal(contactsPage.body.data.length, 1);
  assert.equal(contactsPage.body.pagination.pageSize, 1);
  assert.ok(contactsPage.body.pagination.total > 1);
  assert.equal(typeof contactsPage.body.data[0].diff, 'number');

  const contactSearch = await request(
    `/api/contacts?keyword=${encodeURIComponent('支付宝联系人')}&pageSize=10`,
    { token }
  );
  assert.ok(contactSearch.body.data.length >= 1);
  assert.ok(contactSearch.body.data.every((item) => item.name.includes('支付宝联系人')));

  const eventPage = await request('/api/events?hosted=false&page=1&pageSize=1', { token });
  assert.equal(eventPage.body.data.length, 1);
  assert.equal(eventPage.body.pagination.pageSize, 1);
  assert.equal(typeof eventPage.body.summary.totalAmount, 'number');

  const eventLogsPage1 = await request(`/api/events/${receivedEventId}/logs?page=1&pageSize=1`, {
    token,
  });
  const eventLogsPage2 = await request(`/api/events/${receivedEventId}/logs?page=2&pageSize=1`, {
    token,
  });
  assert.equal(eventLogsPage1.body.data.length, 1);
  assert.equal(eventLogsPage1.body.pagination.hasMore, true);
  assert.notEqual(eventLogsPage1.body.data[0].id, eventLogsPage2.body.data[0].id);
});

test('不同账号之间的数据完全隔离', async () => {
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '第二用户', phone: '13900001002', password: 'Test123456' },
  });
  assert.equal(registration.response.status, 201);
  secondToken = registration.body.data.token;

  const contacts = await request('/api/contacts', { token: secondToken });
  const records = await request('/api/records', { token: secondToken });
  const events = await request('/api/events', { token: secondToken });
  const globalLogs = await request('/api/events/logs', { token: secondToken });
  assert.deepEqual(contacts.body.data, []);
  assert.deepEqual(records.body.data.records, []);
  assert.deepEqual(events.body.data, []);
  assert.deepEqual(globalLogs.body.data, []);

  const logs = await request(`/api/events/${receivedEventId}/logs`, { token: secondToken });
  assert.equal(logs.response.status, 404);
});

test('备份只导出当前用户的逻辑数据且不包含账号凭据', async () => {
  const response = await fetch(`${baseUrl}/api/backups/export`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition'), /\.giftledger/);

  const backup = await response.json();
  assert.equal(backup.format, 'gift-ledger-backup');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.account.name, '主测试用户（已修改）');
  assert.ok(backup.summary.records > 0);
  assert.equal(backup.summary.records, backup.data.records.length);
  assert.ok(!JSON.stringify(backup).includes('password_hash'));
  assert.ok(!JSON.stringify(backup).includes('user_id'));
  assert.ok(!JSON.stringify(backup).includes('13900001001'));
  const primaryUserId = db.prepare('SELECT id FROM users WHERE phone = ?').get('13900001001').id;
  assert.ok(!JSON.stringify(backup).includes(primaryUserId));

  const validated = await request('/api/backups/import/validate', {
    method: 'POST',
    token: secondToken,
    body: backup,
  });
  assert.equal(validated.response.status, 200);
  assert.match(validated.body.data.checksum, /^[a-f0-9]{64}$/);

  const brokenBackup = structuredClone(backup);
  brokenBackup.data.records[0].eventSourceId = 'missing-event';
  const invalid = await request('/api/backups/import/validate', {
    method: 'POST',
    token: secondToken,
    body: brokenBackup,
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.message, /不存在的事件/);

  const invalidDateBackup = structuredClone(backup);
  invalidDateBackup.data.events[0].date = '2026-02-31';
  const invalidDate = await request('/api/backups/import/validate', {
    method: 'POST',
    token: secondToken,
    body: invalidDateBackup,
  });
  assert.equal(invalidDate.response.status, 400);
  assert.match(invalidDate.body.message, /日期格式不正确/);

  const wrongPassword = await request('/api/backups/import', {
    method: 'POST',
    token: secondToken,
    body: {
      backup,
      checksum: validated.body.data.checksum,
      password: 'wrong-password',
    },
  });
  assert.equal(wrongPassword.response.status, 403);
  const emptyRecords = await request('/api/records', { token: secondToken });
  assert.deepEqual(emptyRecords.body.data.records, []);

  const imported = await request('/api/backups/import', {
    method: 'POST',
    token: secondToken,
    body: {
      backup,
      checksum: validated.body.data.checksum,
      password: 'Test123456',
    },
  });
  assert.equal(imported.response.status, 200);
  assert.deepEqual(imported.body.data.summary, backup.summary);

  const secondRecords = await request('/api/records?pageSize=500', { token: secondToken });
  const secondEvents = await request('/api/events', { token: secondToken });
  const secondContacts = await request('/api/contacts', { token: secondToken });
  const secondLogs = await request('/api/events/logs?limit=200', { token: secondToken });
  assert.equal(secondRecords.body.data.records.length, backup.summary.records);
  assert.equal(secondEvents.body.data.length, backup.summary.events);
  assert.equal(secondContacts.body.data.length, backup.summary.contacts);
  assert.equal(secondLogs.body.data.length, backup.summary.operationLogs);
  assert.ok(!backup.data.events.some((item) => item.sourceId === secondEvents.body.data[0].id));

  const secondExportResponse = await fetch(`${baseUrl}/api/backups/export`, {
    headers: { authorization: `Bearer ${secondToken}` },
  });
  const secondBackup = await secondExportResponse.json();
  assert.equal(secondBackup.account.name, '第二用户');

  const primaryRecords = await request('/api/records?pageSize=500', { token });
  assert.equal(primaryRecords.body.data.records.length, backup.summary.records);
});

test('生产环境拒绝缺失或过短的 JWT 密钥', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      "process.env.NODE_ENV='production'; delete process.env.JWT_SECRET; require('./dist/config').getJwtSecret();",
    ],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET/);
});
