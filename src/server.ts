import express from 'express';
import path from 'path';
import { registerWebhookRoutes } from './channels/webhook';
import { registerAdminRoutes } from './web/admin';

export async function startServer(port: number): Promise<void> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 静态文件（Web 管理后台前端）
  app.use('/admin', express.static(path.join(__dirname, '../web/static')));

  // 飞书 Webhook
  registerWebhookRoutes(app);

  // 管理后台 API
  registerAdminRoutes(app);

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: process.env.npm_package_version || '0.1.0' });
  });

  app.listen(port, () => {
    console.log(`All Your Handover 已启动: http://localhost:${port}`);
    console.log(`管理后台: http://localhost:${port}/admin`);
  });
}