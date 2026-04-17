import { Application } from 'express';

export function registerWebhookRoutes(app: Application): void {
  // POST /webhook/feishu — 飞书事件订阅入口
  app.post('/webhook/feishu', async (req, res) => {
    // TODO: 签名验证 + challenge 响应 + 事件路由
    res.json({ code: 0 });
  });

  // POST /webhook/feishu/card — 飞书卡片交互回调
  app.post('/webhook/feishu/card', async (req, res) => {
    // TODO: 签名验证 + 卡片操作处理
    res.json({ code: 0 });
  });
}