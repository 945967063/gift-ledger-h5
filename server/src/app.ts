import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import './db';
import { getAuthRateLimit, getCorsOrigins, getJwtSecret, getPort, isProduction } from './config';
import authRouter from './routes/auth';
import contactsRouter from './routes/contacts';
import eventsRouter from './routes/events';
import recordsRouter from './routes/records';
import statsRouter from './routes/stats';

export const createApp = () => {
  const app = express();
  const corsOrigins = getCorsOrigins();
  getJwtSecret();

  app.disable('x-powered-by');
  if (isProduction) app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors(
      isProduction && corsOrigins.length === 0
        ? { origin: false }
        : {
            credentials: false,
            origin(origin, callback) {
              if (!origin || !isProduction || corsOrigins.includes(origin)) {
                callback(null, true);
                return;
              }
              callback(Object.assign(new Error('该来源不在 CORS 白名单中'), { status: 403 }));
            },
          }
    )
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      code: 200,
      message: 'Gift Ledger API is running',
      timestamp: new Date().toISOString(),
    });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: getAuthRateLimit(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { code: 429, message: '请求过于频繁，请稍后再试' },
  });

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/stats', statsRouter);

  app.use((_req, res) => {
    res.status(404).json({ code: 404, message: 'API route not found' });
  });

  app.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status =
        Number.isInteger(err.status) && err.status! >= 400 && err.status! < 500 ? err.status! : 500;
      if (status >= 500) console.error('[ERROR]', err.message, err.stack);
      const message =
        status === 400 ? '请求数据格式不正确' : status === 403 ? err.message : '服务器内部错误';
      res.status(status).json({
        code: status,
        message,
        ...(isProduction || status < 500 ? {} : { error: err.message }),
      });
    }
  );

  return app;
};

const app = createApp();

if (require.main === module) {
  const port = getPort();
  app.listen(port, () => {
    console.log(`🎋 Gift Ledger API Server running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
  });
}

export default app;
