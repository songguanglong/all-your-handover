import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getSoul, saveSoul, getDefaultSoul, buildSoulPrompt } from '../src/services/soul-service';
import { getAgents, saveAgents, getDefaultAgents } from '../src/services/agents-service';

const TMP_DIR = path.join(__dirname, '__tmp_soul_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('Soul Service (markdown)', () => {
  describe('getSoul', () => {
    it('returns default soul when none saved', async () => {
      const soul = await getSoul('test');
      expect(soul).toContain('交班助手人格');
    });
  });

  describe('saveSoul + getSoul', () => {
    it('saves and retrieves soul markdown', async () => {
      const content = '# 测试人格\n\n我是测试助手。';
      await saveSoul('test', content);
      const loaded = await getSoul('test');
      expect(loaded).toBe(content);
    });
  });

  describe('getDefaultSoul', () => {
    it('returns default soul markdown', () => {
      const defaultSoul = getDefaultSoul();
      expect(defaultSoul).toContain('交班助手人格');
    });
  });

  describe('buildSoulPrompt', () => {
    it('builds prompt with soul only', () => {
      const prompt = buildSoulPrompt('# 我的人格\n\n我是助手。');
      expect(prompt).toContain('我是助手。');
    });

    it('builds prompt with soul + agents', () => {
      const prompt = buildSoulPrompt('# 我的人格\n\n我是助手。', '# 行为守则\n\n- 规则1');
      expect(prompt).toContain('我是助手。');
      expect(prompt).toContain('规则1');
    });
  });
});

describe('Agents Service (markdown)', () => {
  describe('getAgents', () => {
    it('returns default agents when none saved', async () => {
      const agents = await getAgents('test');
      expect(agents).toContain('行为守则');
    });
  });

  describe('saveAgents + getAgents', () => {
    it('saves and retrieves agents markdown', async () => {
      const content = '# 行为守则\n\n- 测试规则';
      await saveAgents('test', content);
      const loaded = await getAgents('test');
      expect(loaded).toBe(content);
    });
  });

  describe('getDefaultAgents', () => {
    it('returns default agents markdown', () => {
      const defaultAgents = getDefaultAgents();
      expect(defaultAgents).toContain('优先级判断');
    });
  });
});