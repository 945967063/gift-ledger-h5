import { describe, expect, it } from 'vitest';
import { mapContact, mapEvent, mapOperationLog, mapRecord } from './mappers';

describe('API 数据映射', () => {
  it('把联系人 snake_case 字段转换为页面模型', () => {
    expect(
      mapContact({
        id: 'c1',
        name: '张三',
        relation: '同事',
        tag: null,
        phone: '13800138000',
        avatar_bg: '#fff',
        created_at: '2026-08-11 10:00:00',
      })
    ).toEqual({
      id: 'c1',
      name: '张三',
      relation: '同事',
      tag: undefined,
      phone: '13800138000',
      remark: undefined,
      avatarBg: '#fff',
      createdAt: '2026-08-11 10:00:00',
    });
  });

  it('正确转换事件布尔值和金额', () => {
    const event = mapEvent({
      id: 'e1',
      title: '婚礼',
      date: '2026-08-11',
      type: 'wedding',
      is_hosted_by_me: 1,
      total_amount: 1388.88,
      guest_count: 2,
      target_contact_name: null,
      notes: null,
      created_at: '2026-08-11 10:00:00',
    });
    expect(event.isHostedByMe).toBe(true);
    expect(event.totalAmount).toBe(1388.88);
    expect(event.guestCount).toBe(2);
  });

  it('保留自定义支付方式并兼容旧记录默认现金', () => {
    const baseRecord = {
      id: 'r1',
      event_id: 'e1',
      event_title: '婚礼',
      event_date: '2026-08-11',
      event_type: 'wedding' as const,
      type: 'received' as const,
      contact_id: 'c1',
      contact_name: '李四',
      contact_relation: '朋友',
      amount: 888,
      remark: null,
      created_at: '2026-08-11 10:00:00',
    };
    expect(
      mapRecord({
        ...baseRecord,
        payment_method: 'custom',
        custom_payment_method: '云闪付',
      })
    ).toMatchObject({ paymentMethod: 'custom', customPaymentMethod: '云闪付' });
    expect(
      mapRecord({
        ...baseRecord,
        payment_method: undefined,
        custom_payment_method: null,
      }).paymentMethod
    ).toBe('cash');
  });

  it('解析操作日志中的变更快照', () => {
    const log = mapOperationLog({
      id: 'l1',
      event_id: 'e1',
      record_id: 'r1',
      action: 'record_updated',
      entity_type: 'record',
      summary: '修改礼金',
      details: JSON.stringify({ before: { amount: 300 }, after: { amount: 666 } }),
      created_at: '2026-08-11 10:30:00',
    });
    expect(log.details?.before?.amount).toBe(300);
    expect(log.details?.after?.amount).toBe(666);
    expect(log.eventId).toBe('e1');
  });
});
