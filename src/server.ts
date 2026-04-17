import express from 'express';
import path from 'path';
import { registerWebhookRoutes } from './channels/webhook';
import { registerAdminRoutes } from './web/admin';

export async function startServer(port: number): Promise<void> {
  const server = express();

  // Limit request body size to 10MB
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files (Web admin frontend)
  const staticDir = path.join(__dirname, 'web/static');
  server.use('/admin', express.static(staticDir));

  // Feishu Webhook
  registerWebhookRoutes(server);

  // Admin API
  registerAdminRoutes(server);

  // Health check
  server.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: process.env.npm_package_version || '0.1.0' });
  });

  server.listen(port, () => {
    console.log(`All Your Handover 已启动: http://localhost:${port}`);
    console.log(`管理后台: http://localhost:${port}/admin`);
  });
}