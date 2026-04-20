import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getSoul, saveSoul, resetSoul, getTemplates, buildSoulPrompt } from '../src/services/agent-soul-service';

const TMP_DIR = path.join(__dirname, '__tmp_soul_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('Agent Soul Service', () => {
  describe('getSoul', () => {
    it('returns default soul when none saved', async () => {
      const soul = await getSoul('test');
      expect(soul.persona).toBe('你是一位交接班助手');
      expect(soul.scenario).toBe('custom');
      expect(soul.constraints).toEqual([]);
    });
  });

  describe('saveSoul + getSoul', () => {
    it('saves and retrieves soul', async () => {
      const soul = {
        persona: '你是一位专业的酒店前台交接班助手',
        scenario: 'hotel',
        constraints: ['关注客房状态'],
        tone: '专业',
      };
      await saveSoul('test', soul);
      const loaded = await getSoul('test');
      expect(loaded.persona).toBe(soul.persona);
      expect(loaded.scenario).toBe('hotel');
      expect(loaded.constraints).toEqual(['关注客房状态']);
      expect(loaded.tone).toBe('专业');
    });
  });

  describe('resetSoul', () => {
    it('resets to default', async () => {
      await saveSoul('test', { persona: 'custom', constraints: ['a'], scenario: 'hotel' });
      await resetSoul('test');
      const soul = await getSoul('test');
      expect(soul.persona).toBe('你是一位交接班助手');
      expect(soul.scenario).toBe('custom');
    });
  });

  describe('getTemplates', () => {
    it('returns builtin templates', () => {
      const templates = getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.find(t => t.id === 'hotel')).toBeTruthy();
      expect(templates.find(t => t.id === 'factory')).toBeTruthy();
      expect(templates.find(t => t.id === 'hospital')).toBeTruthy();
      expect(templates.find(t => t.id === 'custom')).toBeTruthy();
    });
  });

  describe('buildSoulPrompt', () => {
    it('builds prompt with all fields', () => {
      const prompt = buildSoulPrompt({
        persona: '酒店前台助手',
        scenario: 'hotel',
        constraints: ['关注客房', '关注宾客'],
        tone: '专业',
      });
      expect(prompt).toContain('【Agent 人设】');
      expect(prompt).toContain('角色：酒店前台助手');
      expect(prompt).toContain('语气：专业');
      expect(prompt).toContain('- 关注客房');
      expect(prompt).toContain('- 关注宾客');
    });

    it('omits tone and constraints when empty', () => {
      const prompt = buildSoulPrompt({
        persona: '助手',
        scenario: 'custom',
        constraints: [],
      });
      expect(prompt).not.toContain('语气');
      expect(prompt).not.toContain('行为约束');
    });

    it('includes custom scenario description', () => {
      const prompt = buildSoulPrompt({
        persona: '助手',
        scenario: 'custom',
        constraints: [],
        customScenario: '适用于物流中心交接',
      });
      expect(prompt).toContain('场景说明：适用于物流中心交接');
    });
  });
});