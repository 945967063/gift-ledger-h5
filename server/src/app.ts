import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import './db';
import { getAuthRateLimit, getCorsOrigins, getJwtSecret, getPort, isProduction } from './config';
import authRouter from './routes/auth';
import contactsRouter from './routes/contacts';
import eventsRouter from './routes/events';
import recordsRouter from './routes/records';
import statsRouter from './routes/stats';
import backupsRouter, { backupJsonParserOptions } from './routes/backups';
import { authMiddleware } from './middleware/auth';

export const createApp = () => {
  const app = express();
  const corsOrigins = getCorsOrigins();
  getJwtSecret();

  app.disable('x-powered-by');
  if (isProduction) app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(compression());
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
  // 备份文件使用独立限额，不放大其他业务接口的请求体。
  app.use(
    '/api/backups',
    authMiddleware as express.RequestHandler,
    express.json(backupJsonParserOptions),
    backupsRouter
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

  app.use('/api', (_req, res) => {
    res.status(404).json({ code: 404, message: 'API route not found' });
  });

  const frontendDirectory = process.env.FRONTEND_DIR || path.resolve(__dirname, '../public');
  const frontendIndex = path.join(frontendDirectory, 'index.html');
  if (isProduction && fs.existsSync(frontendIndex)) {
    app.use(
      express.static(frontendDirectory, {
        index: false,
        setHeaders(res, filePath) {
          const relativePath = path.relative(frontendDirectory, filePath).split(path.sep).join('/');
          if (/^(?:js|css|png|jpg|jpeg|gif|svg|woff|woff2)\//i.test(relativePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(frontendIndex);
    });
  } else {
    app.use((_req, res) => {
      res.status(404).json({ code: 404, message: 'Route not found' });
    });
  }

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
        status === 400
          ? err.name === 'BackupValidationError'
            ? err.message
            : '请求数据格式不正确'
          : status === 413
            ? '请求内容超过大小限制'
            : status === 403
              ? err.message
              : '服务器内部错误';
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
