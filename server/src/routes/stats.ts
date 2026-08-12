import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { normalizePage } from '../validation';

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: '婚礼',
  baby: '满月',
  housewarming: '乔迁',
  birthday: '生日',
  longevity: '寿宴',
  education: '升学',
  funeral: '白事',
  other: '其他',
};

const router = Router();
router.use(authMiddleware as any);

const parseOptionalYear = (value: unknown): number | null | undefined => {
  if (value === undefined) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return undefined;
  return year;
};

const createYearFilter = (year: number | null, alias = '') => {
  if (year === null) return { sql: '', params: [] as string[] };
  const column = alias ? `${alias}.event_date` : 'event_date';
  return {
    sql: ` AND ${column} >= ? AND ${column} < ?`,
    params: [`${year}-01-01`, `${year + 1}-01-01`],
  };
};

router.get('/years', (req: AuthRequest, res: Response) => {
  const years = db
    .prepare(
      `SELECT DISTINCT CAST(strftime('%Y', event_date) AS INTEGER) AS year
       FROM records
       WHERE user_id = ?
       ORDER BY year DESC`
    )
    .all(req.userId) as { year: number }[];
  res.json({ code: 200, data: years.map((item) => item.year).filter(Boolean) });
});

// GET /api/stats/summary — 总收入/总支出/净余额/最近4条记录
router.get('/summary', (req: AuthRequest, res: Response) => {
  const year = parseOptionalYear(req.query.year);
  if (year === undefined) {
    res.status(400).json({ code: 400, message: '年份不合法' });
    return;
  }
  const yearFilter = createYearFilter(year);
  const summary = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS totalIncome,
         COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS totalExpense
       FROM records
       WHERE user_id = ?${yearFilter.sql}`
    )
    .get(req.userId, ...yearFilter.params) as { totalIncome: number; totalExpense: number };

  const recentRecords = db
    .prepare(
      `SELECT * FROM records
       WHERE user_id = ?${yearFilter.sql}
       ORDER BY created_at DESC, id DESC
       LIMIT 4`
    )
    .all(req.userId, ...yearFilter.params);

  res.json({
    code: 200,
    data: {
      totalIncome: Number(summary.totalIncome || 0),
      totalExpense: Number(summary.totalExpense || 0),
      netBalance: Number(summary.totalIncome || 0) - Number(summary.totalExpense || 0),
      recentRecords,
    },
  });
});

// GET /api/stats/monthly?year=2024
router.get('/monthly', (req: AuthRequest, res: Response) => {
  const requestedYear = Number(req.query.year || new Date().getFullYear());
  if (!Number.isInteger(requestedYear) || requestedYear < 1900 || requestedYear > 2200) {
    res.status(400).json({ code: 400, message: '年份不合法' });
    return;
  }
  const year = String(requestedYear);

  const rows = db
    .prepare(
      `SELECT
       CAST(strftime('%m', event_date) AS INTEGER) as month,
       type,
       COALESCE(SUM(amount), 0) as total
     FROM records
     WHERE user_id = ? AND strftime('%Y', event_date) = ?
     GROUP BY month, type
     ORDER BY month`
    )
    .all(req.userId, year) as { month: number; type: string; total: number }[];

  // Build 12-month array
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthLabel: `${i + 1}月`,
    received: 0,
    given: 0,
  }));

  rows.forEach(({ month, type, total }) => {
    if (month >= 1 && month <= 12) {
      if (type === 'received') months[month - 1].received = total;
      else months[month - 1].given = total;
    }
  });

  res.json({ code: 200, data: months });
});

// GET /api/stats/top-contacts?limit=5
router.get('/top-contacts', (req: AuthRequest, res: Response) => {
  const limit = normalizePage(req.query.limit, 5, 50);
  const year = parseOptionalYear(req.query.year);
  if (year === undefined) {
    res.status(400).json({ code: 400, message: '年份不合法' });
    return;
  }
  const yearFilter = createYearFilter(year, 'r');

  const rows = db
    .prepare(
      `SELECT
       r.contact_name as name,
       r.contact_id as contact_id,
       r.contact_relation as relation,
       c.tag,
       COALESCE(SUM(CASE WHEN r.type = 'received' THEN r.amount ELSE 0 END), 0) as received,
       COALESCE(SUM(CASE WHEN r.type = 'given' THEN r.amount ELSE 0 END), 0) as given,
       SUM(r.amount) as total
     FROM records r
     LEFT JOIN contacts c ON c.id = r.contact_id AND c.user_id = r.user_id
     WHERE r.user_id = ?
       AND r.contact_name IS NOT NULL
       AND r.contact_name != ''
       ${yearFilter.sql}
     GROUP BY r.contact_name
     ORDER BY total DESC
     LIMIT ?`
    )
    .all(req.userId, ...yearFilter.params, limit);

  res.json({ code: 200, data: rows });
});

// GET /api/stats/category — 人情类型分布
router.get('/category', (req: AuthRequest, res: Response) => {
  const year = parseOptionalYear(req.query.year);
  if (year === undefined) {
    res.status(400).json({ code: 400, message: '年份不合法' });
    return;
  }
  const yearFilter = createYearFilter(year);
  const rows = db
    .prepare(
      `SELECT event_type, SUM(amount) as total
     FROM records
     WHERE user_id = ?${yearFilter.sql}
     GROUP BY event_type
     ORDER BY total DESC`
    )
    .all(req.userId, ...yearFilter.params) as { event_type: string; total: number }[];

  const grandTotal = rows.reduce((s, r) => s + r.total, 0) || 1;
  const data = rows.map((r) => ({
    type: r.event_type,
    label: EVENT_TYPE_LABELS[r.event_type] || EVENT_TYPE_LABELS.other,
    amount: r.total,
    percent: Math.round((r.total / grandTotal) * 100),
  }));

  res.json({ code: 200, data });
});

export default router;
