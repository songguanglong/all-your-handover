import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { registerWebhookRoutes } from '../src/channels/webhook';
import { registerAdminRoutes } from '../src/web/admin';
import { saveChannelsConfig, loadLLMProvidersConfig } from '../src/services/config-service';
import { createDraft, appendToDraft, readDraft, clearDraft, parseDraftSections, updateDraftAnalysis } from '../src/services/draft-service';
import { savePendingHandover, findPendingHandover, removePendingHandover, buildHandoverRecord, saveHandoverRecord, formatDate, formatYearMonth } from '../src/services/handover-service';
import { encrypt, decrypt } from '../src/utils/encryption';
import type { UserInfo } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_integration_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('Integration Tests', () => {
  describe('Webhook to Draft flow', () => {
    it('creates draft and appends text message', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
        ],
      });

      const sender: UserInfo = { id: 'u1', name: '张三' };
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender, rawContent: '301房客人要求延住',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      const draft = await readDraft('qiantai');
      expect(draft).toContain('301房客人要求延住');
      expect(draft).toContain('张三');
    });

    it('appends multiple messages and updates analysis', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
        ],
      });

      const sender1: UserInfo = { id: 'u1', name: '张三' };
      const sender2: UserInfo = { id: 'u2', name: '李四' };

      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender: sender1, rawContent: '301延住',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });
      await appendToDraft('qiantai', {
        messageId: 'msg_2', type: 'text', sender: sender2, rawContent: '402退房',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      await updateDraftAnalysis('qiantai', 'msg_1', {
        category: '客房', content: '客人延住需求', urgency: 'normal',
      });

      const draft = await readDraft('qiantai');
      expect(draft).toContain('analyzed');
      expect(draft).toContain('客房');

      const { rawRecords, llmPreview } = parseDraftSections(draft);
      expect(rawRecords).toContain('301延住');
      expect(rawRecords).toContain('402退房');
    });
  });

  describe('Full Handover Mode A (requireAccept=true)', () => {
    it('messages → draft → handover start → pending → accept → record', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
        ],
      });

      const sender: UserInfo = { id: 'u1', name: '张三' };
      const receiver: UserInfo = { id: 'u2', name: '李四' };

      // Step 1: Create draft with messages
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender, rawContent: '301延住',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      // Step 2: Handover start — save pending
      const draft = await readDraft('qiantai');
      expect(draft).not.toBeNull();
      await savePendingHandover('qiantai', sender, '交接内容');

      // Step 3: Verify pending exists
      const pending = await findPendingHandover('qiantai');
      expect(pending).not.toBeNull();
      expect(pending!.sender).toEqual({ id: 'u1', name: '张三' });

      // Step 4: Accept — build record and clear
      const now = new Date().toISOString();
      const record = await buildHandoverRecord('qiantai', sender, receiver, '交接内容', {
        requireAccept: true, createdAt: pending!.createdAt as string, completedAt: now,
      });

      const filename = `${formatDate()}_${sender.id}_${receiver.id}.md`;
      const filePath = await saveHandoverRecord('qiantai', filename, record);

      // Step 5: Cleanup
      await clearDraft('qiantai');
      await removePendingHandover('qiantai');

      // Verify
      expect(await readDraft('qiantai')).toBeNull();
      expect(await findPendingHandover('qiantai')).toBeNull();

      const savedRecord = await fs.readFile(filePath, 'utf-8');
      expect(savedRecord).toContain('status: completed');
      expect(savedRecord).toContain('交接内容');
    });
  });

  describe('Full Handover Mode B (requireAccept=false)', () => {
    it('messages → draft → handover start → auto-archive', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: false, messageFilter: 'all' }, isEnabled: true },
        ],
      });

      const sender: UserInfo = { id: 'u1', name: '张三' };

      // Create draft
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender, rawContent: '402退房',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      // Auto-archive directly
      const now = new Date().toISOString();
      const record = await buildHandoverRecord('qiantai', sender, null, '交接内容', {
        requireAccept: false, createdAt: now,
      });

      const filename = `${formatDate()}_${sender.id}_archived.md`;
      await saveHandoverRecord('qiantai', filename, record);
      await clearDraft('qiantai');

      // Verify
      expect(await readDraft('qiantai')).toBeNull();
      expect(record).toContain('status: archived');
    });
  });

  describe('Cancel flow', () => {
    it('handover start → cancel → pending removed, draft preserved', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
        ],
      });

      const sender: UserInfo = { id: 'u1', name: '张三' };

      // Create draft and pending
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender, rawContent: '测试',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });
      await savePendingHandover('qiantai', sender, '交接内容');

      // Cancel
      await removePendingHandover('qiantai');

      // Verify: draft preserved, pending removed
      expect(await readDraft('qiantai')).not.toBeNull();
      expect(await findPendingHandover('qiantai')).toBeNull();
    });
  });

  describe('API Key encryption at rest', () => {
    it('encrypts API keys in config files', async () => {
      const { saveLLMProvidersConfig } = await import('../src/services/config-service');
      const apiKey = 'sk-secret-key-12345';
      const encrypted = await encrypt(apiKey);

      await saveLLMProvidersConfig({
        providers: [{
          id: 'p1', name: 'Test', type: 'openai', apiKey: encrypted,
          baseUrl: 'https://api.openai.com', model: 'gpt-4',
          isDefault: true, isEnabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
        }],
        defaultProviderId: 'p1',
      });

      // Read raw file to verify key is encrypted
      const raw = await fs.readFile(path.join(TMP_DIR, 'config/llm-providers.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.providers[0].apiKey).not.toBe(apiKey);
      expect(parsed.providers[0].apiKey).toContain(':'); // Encrypted format: iv:tag:ciphertext

      // Verify decryption works
      const decrypted = await decrypt(parsed.providers[0].apiKey);
      expect(decrypted).toBe(apiKey);
    });
  });

  describe('Admin API integration', () => {
    function createApp() {
      const app = express();
      app.use(express.json());
      registerAdminRoutes(app);
      return app;
    }

    it('first-run → wizard → add provider → add channel → query handovers', async () => {
      const app = createApp();

      // 1. Check status — should be firstRun
      const status = await request(app).get('/api/admin/status');
      expect(status.body.data.firstRun).toBe(true);

      // 2. Add LLM provider
      const providerRes = await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'OpenAI', type: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com', model: 'gpt-4', isDefault: true });
      expect(providerRes.body.code).toBe(0);

      // 3. Add channel
      const channelRes = await request(app)
        .post('/api/admin/channels')
        .send({ code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123' });
      expect(channelRes.body.code).toBe(0);

      // 4. Verify no longer firstRun
      const status2 = await request(app).get('/api/admin/status');
      expect(status2.body.data.firstRun).toBe(false);
      expect(status2.body.data.channelCount).toBe(1);
      expect(status2.body.data.providerCount).toBe(1);

      // 5. Query handovers (empty)
      const handovers = await request(app).get('/api/admin/handovers');
      expect(handovers.body.code).toBe(0);
      expect(handovers.body.data.total).toBe(0);
    });
  });

  describe('Input validation', () => {
    it('rejects invalid channel codes', async () => {
      const app = express();
      app.use(express.json());
      registerAdminRoutes(app);

      const res = await request(app)
        .post('/api/admin/channels')
        .send({ code: 'invalid!code', type: 'feishu', name: '测试', chatId: 'oc_1' });
      expect(res.status).toBe(400);
    });

    it('rejects provider creation without required fields', async () => {
      const app = express();
      app.use(express.json());
      registerAdminRoutes(app);

      const res = await request(app)
        .post('/api/admin/llm-providers')
        .send({ name: 'test' });
      expect(res.status).toBe(400);
    });
  });
});