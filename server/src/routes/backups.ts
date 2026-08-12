import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import db from '../db';
import { AuthRequest } from '../middleware/auth';
import {
  BackupValidationError,
  createUserBackup,
  getBackupChecksum,
  MAX_BACKUP_BYTES,
  parseBackup,
  replaceUserDataFromBackup,
} from '../backup/backup.service';

const router = Router();
const restoreLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId!,
  message: { code: 429, message: '恢复尝试过于频繁，请稍后再试' },
});

router.get('/export', (req: AuthRequest, res: Response) => {
  const backup = createUserBackup(req.userId!);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `gift-ledger-${date}.giftledger`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/vnd.gift-ledger.backup+json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Backup-Checksum', getBackupChecksum(backup));
  res.send(JSON.stringify(backup));
});

router.post('/import/validate', (req: AuthRequest, res: Response) => {
  const backup = parseBackup(req.body);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    code: 200,
    message: '备份文件校验通过',
    data: {
      checksum: getBackupChecksum(backup),
      exportedAt: backup.exportedAt,
      appVersion: backup.appVersion,
      accountName: backup.account.name,
      summary: backup.summary,
    },
  });
});

router.post('/import', restoreLimiter, (req: AuthRequest, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new BackupValidationError('导入请求格式不正确');
  }
  const body = req.body as Record<string, unknown>;
  const password = typeof body.password === 'string' ? body.password : '';
  const expectedChecksum = typeof body.checksum === 'string' ? body.checksum : '';
  if (!password || !expectedChecksum) {
    throw new BackupValidationError('请输入当前账号密码并重新校验备份文件');
  }

  const backup = parseBackup(body.backup);
  const actualChecksum = getBackupChecksum(backup);
  if (actualChecksum !== expectedChecksum) {
    throw new BackupValidationError('备份文件已发生变化，请重新选择并校验');
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as
    | { password_hash: string }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(403).json({ code: 403, message: '当前账号密码错误' });
    return;
  }

  const summary = replaceUserDataFromBackup(req.userId!, backup);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ code: 200, message: '备份数据已恢复', data: { summary } });
});

export const backupJsonParserOptions = {
  limit: `${Math.ceil(MAX_BACKUP_BYTES / 1024 / 1024) + 2}mb`,
  strict: true,
};

export default router;
