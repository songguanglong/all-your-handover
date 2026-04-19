import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { registerAdminRoutes } from '../src/web/admin';

const TMP_DIR = path.join(__dirname, '__tmp_admin_test');

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminRoutes(app);
  return app;
}

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('Admin API', () => {
  describe('GET /api/admin/status', () => {
    it('returns system status', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/status');
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.firstRun).toBe(true);
    });
  });

  describe('LLM Providers', () => {
    it('lists providers (empty initially)', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/llm-providers');
      expect(res.status).toBe(200);
      expect(res.body.data.providers).toEqual([]);
    });

    it('creates a provider', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'OpenAI', type: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com', model: 'gpt-4' });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBeTruthy();
    });

    it('validates required fields', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'test' });
      expect(res.status).toBe(400);
    });

    it('deletes a provider', async () => {
      const app = createApp();
      // Create first
      const createRes = await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'OpenAI', type: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com', model: 'gpt-4' });
      const id = createRes.body.data.id;

      const delRes = await request(app).delete(`/api/admin/llm-providers/${id}`);
      expect(delRes.status).toBe(200);

      // Verify it's gone
      const listRes = await request(app).get('/api/admin/llm-providers');
      expect(listRes.body.data.providers).toHaveLength(0);
    });

    it('masks API keys in GET response', async () => {
      const app = createApp();
      await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'OpenAI', type: 'openai', apiKey: 'sk-test-secret-key', baseUrl: 'https://api.openai.com', model: 'gpt-4' });

      const res = await request(app).get('/api/admin/llm-providers');
      const provider = res.body.data.providers[0];
      expect(provider.apiKey).toBe('***');
    });
  });

  describe('Channels', () => {
    it('lists channels (empty initially)', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/channels');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('creates a channel with valid code', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/channels')
        .send({ code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123' });
      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe('qiantai');
    });

    it('rejects invalid channel code', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/channels')
        .send({ code: '前台!', type: 'feishu', name: '前台群', chatId: 'oc_123' });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate channel code', async () => {
      const app = createApp();
      await request(app)
        .post('/api/admin/channels')
        .send({ code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123' });
      const res = await request(app)
        .post('/api/admin/channels')
        .send({ code: 'qiantai', type: 'feishu', name: '前台群2', chatId: 'oc_456' });
      expect(res.status).toBe(400);
    });

    it('deletes a channel', async () => {
      const app = createApp();
      await request(app)
        .post('/api/admin/channels')
        .send({ code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123' });

      const res = await request(app).delete('/api/admin/channels/qiantai');
      expect(res.status).toBe(200);
    });
  });

  describe('Template', () => {
    it('returns default template when none set', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/channels/qiantai/template');
      expect(res.status).toBe(200);
      expect(res.body.data.template).toContain('交接单');
    });

    it('saves a custom template', async () => {
      const app = createApp();
      await request(app)
        .put('/api/admin/channels/qiantai/template')
        .send({ template: '# Custom' });
      const res = await request(app).get('/api/admin/channels/qiantai/template');
      expect(res.body.data.template).toBe('# Custom');
    });

    it('resets to default template', async () => {
      const app = createApp();
      await request(app)
        .put('/api/admin/channels/qiantai/template')
        .send({ template: '# Custom' });
      await request(app).put('/api/admin/channels/qiantai/template/reset');
      const res = await request(app).get('/api/admin/channels/qiantai/template');
      expect(res.body.data.template).toContain('重要事项');
    });
  });

  describe('System Prompt', () => {
    it('returns default system prompt when none set', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/channels/qiantai/system-prompt');
      expect(res.status).toBe(200);
      expect(res.body.data.systemPrompt).toContain('交接班助手');
    });

    it('saves a custom system prompt', async () => {
      const app = createApp();
      await request(app)
        .put('/api/admin/channels/qiantai/system-prompt')
        .send({ systemPrompt: '你是一个工厂交接班助手。' });
      const res = await request(app).get('/api/admin/channels/qiantai/system-prompt');
      expect(res.body.data.systemPrompt).toBe('你是一个工厂交接班助手。');
    });

    it('rejects system prompt over 4096 chars', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/admin/channels/qiantai/system-prompt')
        .send({ systemPrompt: 'x'.repeat(4097) });
      expect(res.status).toBe(400);
    });

    it('resets to default system prompt', async () => {
      const app = createApp();
      await request(app)
        .put('/api/admin/channels/qiantai/system-prompt')
        .send({ systemPrompt: 'Custom prompt' });
      await request(app).put('/api/admin/channels/qiantai/system-prompt/reset');
      const res = await request(app).get('/api/admin/channels/qiantai/system-prompt');
      expect(res.body.data.systemPrompt).toContain('交接班助手');
    });

    it('rejects invalid channel code for system prompt', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/channels/bad!code/system-prompt');
      expect(res.status).toBe(400);
    });

    it('interview endpoint rejects empty messages', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/channels/qiantai/system-prompt/interview')
        .send({ messages: [] });
      expect(res.status).toBe(400);
    });

    it('interview endpoint rejects invalid channel code', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/channels/bad!code/system-prompt/interview')
        .send({ messages: [{ role: 'user', content: 'hello' }] });
      expect(res.status).toBe(400);
    });
  });

  describe('Platforms', () => {
    it('returns null for unconfigured platform', async () => {
      const app = createApp();
      const res = await request(app).get('/api/admin/platforms/feishu');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('updates platform config with masked response', async () => {
      const app = createApp();
      await request(app)
        .put('/api/admin/platforms/feishu')
        .send({ appId: 'app_123', appSecret: 'secret_123', verificationToken: 'token_123' });

      const res = await request(app).get('/api/admin/platforms/feishu');
      expect(res.body.data.appId).toBe('app_123');
      expect(res.body.data.appSecret).toBe('***masked***');
    });
  });
});