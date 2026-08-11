const DEVELOPMENT_JWT_SECRET = 'gift_ledger_local_development_secret_change_me';

export const isProduction = process.env.NODE_ENV === 'production';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (isProduction && (!secret || secret.length < 32)) {
    throw new Error('生产环境必须配置长度至少为 32 位的 JWT_SECRET');
  }
  return secret || DEVELOPMENT_JWT_SECRET;
};

export const getCorsOrigins = (): string[] =>
  (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getPort = (): number => {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT 必须是有效端口号');
  }
  return port;
};

export const getAuthRateLimit = (): number => {
  const limit = Number(process.env.AUTH_RATE_LIMIT || 100);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 10_000) {
    throw new Error('AUTH_RATE_LIMIT 必须是 1 至 10000 之间的整数');
  }
  return limit;
};
