import { Application } from 'express';

export function registerAdminRoutes(app: Application): void {
  const prefix = '/api/admin';

  // LLM Provider 管理
  // GET/POST/PUT/DELETE /api/admin/llm-providers

  // 平台配置
  // GET/PUT /api/admin/platforms/:type

  // 渠道管理
  // GET/POST/PUT/DELETE /api/admin/channels

  // 交接模版
  // GET/PUT /api/admin/channels/:code/template

  // 历史查询
  // GET /api/admin/handovers

  // 运行监控
  // GET /api/admin/status
  // GET /api/admin/llm-queue

  // TODO: 实现上述路由
  app.get(`${prefix}/status`, (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
}