import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware as any);

// GET /api/stats/summary — 总收入/总支出/净余额/最近4条记录
router.get('/summary', (req: AuthRequest, res: Response) => {
  const received = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM records WHERE user_id = ? AND type = 'received'`
    )
    .get(req.userId) as { total: number };

  const given = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM records WHERE user_id = ? AND type = 'given'`
    )
    .get(req.userId) as { total: number };

  const recentRecords = db
    .prepare(`SELECT * FROM records WHERE user_id = ? ORDER BY created_at DESC LIMIT 4`)
    .all(req.userId);

  res.json({
    code: 200,
    data: {
      totalIncome: received.total,
      totalExpense: given.total,
      netBalance: received.total - given.total,
      recentRecords,
    },
  });
});

// GET /api/stats/monthly?year=2024
router.get('/monthly', (req: AuthRequest, res: Response) => {
  const year = req.query.year || new Date().getFullYear();

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
    .all(req.userId, String(year)) as { month: number; type: string; total: number }[];

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
  const limit = Number(req.query.limit) || 5;

  const rows = db
    .prepare(
      `SELECT
       r.contact_name as name,
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
     GROUP BY r.contact_name
     ORDER BY total DESC
     LIMIT ?`
    )
    .all(req.userId, limit);

  res.json({ code: 200, data: rows });
});

// GET /api/stats/category — 人情类型分布
router.get('/category', (req: AuthRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT event_type, SUM(amount) as total
     FROM records
     WHERE user_id = ?
     GROUP BY event_type
     ORDER BY total DESC`
    )
    .all(req.userId) as { event_type: string; total: number }[];

  const grandTotal = rows.reduce((s, r) => s + r.total, 0) || 1;
  const data = rows.map((r) => ({
    label: r.event_type,
    amount: r.total,
    percent: Math.round((r.total / grandTotal) * 100),
  }));

  res.json({ code: 200, data });
});

export default router;
