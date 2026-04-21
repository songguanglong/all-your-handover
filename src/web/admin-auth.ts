import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

let tokenWarningLogged = false;

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    if (!tokenWarningLogged) {
      logger.warn('ADMIN_TOKEN 未设置，管理后台接口无认证保护！生产环境请务必设置 ADMIN_TOKEN 环境变量');
      tokenWarningLogged = true;
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: -1, message: '缺少认证信息' });
    return;
  }

  const token = authHeader.slice(7);
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(adminToken);
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    logger.warn(`Admin auth failed from ${req.ip}`);
    res.status(403).json({ code: -1, message: '认证失败' });
    return;
  }

  next();
}