import type { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/session-token';

declare global {
  namespace Express {
    interface Request {
      h5Session?: { open_id: string; name: string };
    }
  }
}

/** Read-only operations: attach session if present, but don't reject */
export async function h5OptionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const session = await verifySessionToken(token);
    if (session) req.h5Session = session;
  }
  next();
}

/** Write operations: require valid session */
export async function h5RequireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ code: -1, message: '请先完成飞书认证' });
    return;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    res.status(401).json({ code: -1, message: '认证已过期，请重新登录' });
    return;
  }

  req.h5Session = session;
  next();
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}