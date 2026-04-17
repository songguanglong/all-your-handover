import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  loadChannelsConfig,
  saveChannelsConfig,
  findChannelCodeByChatId,
  getChannelConfig,
  loadLLMProvidersConfig,
  saveLLMProvidersConfig,
  getDefaultProviderConfig,
  getTemplate,
  saveTemplate,
  getDefaultTemplate,
} from '../src/services/config-service';

const TMP_DIR = path.join(__dirname, '__tmp_config_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('config-service', () => {
  describe('channels config', () => {
    it('returns empty default when no config file', async () => {
      const config = await loadChannelsConfig();
      expect(config).toEqual({ platforms: {}, channels: [] });
    });

    it('saves and loads channels config', async () => {
      const config = {
        platforms: { feishu: { appId: 'a', appSecret: 's', verificationToken: 't' } },
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' as const }, isEnabled: true },
        ],
      };
      await saveChannelsConfig(config);
      const loaded = await loadChannelsConfig();
      expect(loaded.channels).toHaveLength(1);
      expect(loaded.channels[0].code).toBe('qiantai');
    });

    it('finds channel code by chatId', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
          { code: 'kefang', type: 'feishu', name: '客房群', chatId: 'oc_456', settings: { requireAccept: false, messageFilter: 'mention' }, isEnabled: true },
        ],
      });
      expect(await findChannelCodeByChatId('oc_123')).toBe('qiantai');
      expect(await findChannelCodeByChatId('oc_456')).toBe('kefang');
      expect(await findChannelCodeByChatId('oc_999')).toBeNull();
    });

    it('does not find disabled channels by chatId', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: false },
        ],
      });
      expect(await findChannelCodeByChatId('oc_123')).toBeNull();
    });

    it('gets channel config by code', async () => {
      await saveChannelsConfig({
        platforms: {},
        channels: [
          { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
        ],
      });
      const ch = await getChannelConfig('qiantai');
      expect(ch?.name).toBe('前台群');
      expect(await getChannelConfig('nonexist')).toBeNull();
    });
  });

  describe('llm providers config', () => {
    it('returns empty default when no config file', async () => {
      const config = await loadLLMProvidersConfig();
      expect(config).toEqual({ providers: [], defaultProviderId: null });
    });

    it('saves and loads providers config', async () => {
      const config = {
        providers: [
          { id: 'p1', name: 'OpenAI', type: 'openai', apiKey: 'key1', baseUrl: 'https://api.openai.com', model: 'gpt-4', isDefault: true, isEnabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        ],
        defaultProviderId: 'p1',
      };
      await saveLLMProvidersConfig(config);
      const loaded = await loadLLMProvidersConfig();
      expect(loaded.providers).toHaveLength(1);
      expect(loaded.defaultProviderId).toBe('p1');
    });

    it('gets default provider config', async () => {
      await saveLLMProvidersConfig({
        providers: [
          { id: 'p1', name: 'OpenAI', type: 'openai', apiKey: 'key1', baseUrl: 'https://api.openai.com', model: 'gpt-4', isDefault: true, isEnabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        ],
        defaultProviderId: 'p1',
      });
      const provider = await getDefaultProviderConfig();
      expect(provider?.name).toBe('OpenAI');
    });

    it('returns null when no default provider', async () => {
      await saveLLMProvidersConfig({ providers: [], defaultProviderId: null });
      expect(await getDefaultProviderConfig()).toBeNull();
    });
  });

  describe('template', () => {
    it('returns default template when no channel template', async () => {
      const tmpl = await getTemplate('nonexist');
      expect(tmpl).toContain('交接单');
    });

    it('saves and loads channel template', async () => {
      await saveTemplate('qiantai', '# Custom Template');
      const tmpl = await getTemplate('qiantai');
      expect(tmpl).toBe('# Custom Template');
    });

    it('getDefaultTemplate returns non-empty string', () => {
      expect(getDefaultTemplate()).toContain('重要事项');
    });
  });
});