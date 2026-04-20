import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getExperience, addEntry, removeEntry, buildExperiencePrompt, analyzeEditIntent } from '../src/services/experience-service';

const TMP_DIR = path.join(__dirname, '__tmp_exp_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('Experience Service', () => {
  describe('getExperience', () => {
    it('returns empty experience when none saved', async () => {
      const exp = await getExperience('test');
      expect(exp.entries).toEqual([]);
    });
  });

  describe('addEntry + getExperience', () => {
    it('adds and retrieves entries', async () => {
      await addEntry('test', {
        id: 'exp_1',
        createdAt: '2026-01-01T00:00:00Z',
        source: 'edit',
        rule: '用户偏好简短摘要',
      });
      const exp = await getExperience('test');
      expect(exp.entries).toHaveLength(1);
      expect(exp.entries[0].rule).toBe('用户偏好简短摘要');
      expect(exp.entries[0].source).toBe('edit');
    });
  });

  describe('removeEntry', () => {
    it('removes a specific entry', async () => {
      await addEntry('test', { id: 'exp_1', createdAt: '', source: 'edit', rule: 'r1' });
      await addEntry('test', { id: 'exp_2', createdAt: '', source: 'dream', rule: 'r2' });
      await removeEntry('test', 'exp_1');
      const exp = await getExperience('test');
      expect(exp.entries).toHaveLength(1);
      expect(exp.entries[0].id).toBe('exp_2');
    });
  });

  describe('buildExperiencePrompt', () => {
    it('returns undefined for empty experience', () => {
      expect(buildExperiencePrompt({ entries: [] })).toBeUndefined();
    });

    it('builds prompt from entries', () => {
      const prompt = buildExperiencePrompt({
        entries: [
          { id: '1', createdAt: '', source: 'edit', rule: '规则一' },
          { id: '2', createdAt: '', source: 'dream', rule: '规则二' },
        ],
      });
      expect(prompt).toContain('【经验规则】');
      expect(prompt).toContain('1. 规则一');
      expect(prompt).toContain('2. 规则二');
    });
  });

  describe('analyzeEditIntent', () => {
    it('returns null when versions are identical', async () => {
      const mockChat = async () => 'should not be called';
      const result = await analyzeEditIntent('test', 'same', 'same', mockChat);
      expect(result).toBeNull();
    });

    it('returns experience entry from LLM analysis', async () => {
      const mockChat = async () => '用户偏好将紧急事项放在最前面';
      const result = await analyzeEditIntent('test', 'LLM version', 'User version', mockChat);
      expect(result).not.toBeNull();
      expect(result!.rule).toBe('用户偏好将紧急事项放在最前面');
      expect(result!.source).toBe('edit');
      expect(result!.id).toContain('exp_');
    });

    it('returns null on LLM error', async () => {
      const mockChat = async () => { throw new Error('API error'); };
      const result = await analyzeEditIntent('test', 'a', 'b', mockChat);
      expect(result).toBeNull();
    });
  });
});