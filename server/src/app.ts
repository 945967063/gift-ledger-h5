import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Initialize DB (creates tables on first run)
import './db';

import authRouter from './routes/auth';
import contactsRouter from './routes/contacts';
import eventsRouter from './routes/events';
import recordsRouter from './routes/records';
import statsRouter from './routes/stats';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    code: 200,
    message: 'Gift Ledger API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/stats', statsRouter);

// ── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ code: 404, message: 'API route not found' });
});

// ── Global Error Handler ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: err.message });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎋 Gift Ledger API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
