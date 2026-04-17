import type { Request, Response, NextFunction, Router } from 'express';
import { registerLLMRoutes } from './admin-llm';
import { registerPlatformRoutes } from './admin-platforms';
import { registerChannelRoutes } from './admin-channels';
import { registerTemplateRoutes } from './admin-template';
import { registerHandoverRoutes } from './admin-handovers';
import { registerMonitoringRoutes } from './admin-monitoring';
import { timingSafeEqual } from 'crypto';

function getAdminToken(): string | null {
  return process.env.ADMIN_TOKEN || null;
}

function isAdminAuthEnabled(): boolean {
  return !!process.env.ADMIN_TOKEN;
}

function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthEnabled()) {
    return next();
  }

  const token = getAdminToken()!;
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ code: -1, message: 'Authentication required' });
    return;
  }

  const provided = auth.slice(7);
  if (provided.length !== token.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(token))) {
    res.status(401).json({ code: -1, message: 'Invalid token' });
    return;
  }

  next();
}

export function registerAdminRoutes(router: Router): void {
  const prefix = '/api/admin';

  // Apply auth middleware to all admin routes
  router.use(prefix, adminAuthMiddleware);

  registerLLMRoutes(router, prefix);
  registerPlatformRoutes(router, prefix);
  registerChannelRoutes(router, prefix);
  registerTemplateRoutes(router, prefix);
  registerHandoverRoutes(router, prefix);
  registerMonitoringRoutes(router, prefix);
}