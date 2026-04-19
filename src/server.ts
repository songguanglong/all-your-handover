import express from 'express';
import path from 'path';
import http from 'http';
import { registerWebhookRoutes } from './channels/webhook';
import { registerAdminRoutes } from './web/admin';
import { logger } from './utils/logger';

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

export async function startServer(port: number): Promise<http.Server> {
  const app = express();

  // Capture raw body for webhook signature verification before JSON parsing
  app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => { (req as express.Request).rawBody = buf.toString(); },
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files (Web admin frontend)
  const staticDir = path.join(__dirname, 'web/static');
  app.use('/admin', express.static(staticDir));

  // Feishu Webhook
  registerWebhookRoutes(app);

  // Admin API
  registerAdminRoutes(app);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: process.env.npm_package_version || '0.1.0' });
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`All Your Handover 已启动: http://localhost:${port}`);
      logger.info(`管理后台: http://localhost:${port}/admin`);
      resolve(server);
    });
  });
}