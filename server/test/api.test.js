const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-ledger-api-'));
process.env.NODE_ENV = 'test';
process.env.DB_DIR = testDbDir;
process.env.JWT_SECRET = 'gift-ledger-test-secret-with-more-than-32-characters';
process.env.AUTH_RATE_LIMIT = '1000';

const app = require('../dist/app').default;
const db = require('../dist/db').default;

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

test('统计接口与分页边界返回稳定数据', async () => {
  const summary = await request('/api/stats/summary', { token });
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.data.totalIncome, 888.88);
  assert.equal(summary.body.data.totalExpense, 800);
  assert.equal(summary.body.data.netBalance, 88.88);

  const category = await request('/api/stats/category', { token });
  assert.equal(category.response.status, 200);
  assert.ok(category.body.data.every((item) => item.label && item.type));

  const paged = await request('/api/records?page=0&pageSize=99999', { token });
  assert.equal(paged.response.status, 200);
  assert.equal(paged.body.data.page, 1);
  assert.equal(paged.body.data.pageSize, 500);
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
  assert.deepEqual(contacts.body.data, []);
  assert.deepEqual(records.body.data.records, []);
  assert.deepEqual(events.body.data, []);
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
