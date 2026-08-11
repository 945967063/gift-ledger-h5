export const EVENT_TYPES = new Set([
  'wedding',
  'baby',
  'housewarming',
  'birthday',
  'longevity',
  'education',
  'funeral',
  'other',
]);

export const RECORD_TYPES = new Set(['received', 'given']);
export const PAYMENT_METHODS = new Set(['cash', 'wechat', 'alipay', 'custom']);
export const RELATION_TYPES = new Set(['亲戚', '朋友', '同学', '同事', '合作伙伴', '长辈', '其他']);

export const normalizeString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
};

export const normalizeOptionalString = (
  value: unknown,
  maxLength: number
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
};

export const normalizeNullableString = (
  value: unknown,
  maxLength: number
): string | null | undefined => {
  if (value === undefined) return null;
  return normalizeOptionalString(value, maxLength);
};

export const normalizeAmount = (value: unknown): number | null => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return null;
  return Math.round(amount * 100) / 100;
};

export const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
};

export const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  return /^1[3-9]\d{9}$/.test(phone) ? phone : null;
};

export const normalizePage = (value: unknown, fallback: number, max: number): number => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};
