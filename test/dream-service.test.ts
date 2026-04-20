import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getDreamConfig, saveDreamConfig, runDream, shouldRunDream } from '../src/services/dream-service';
import { addEntry, saveExperience } from '../src/services/experience-service';

const TMP_DIR = path.join(__dirname, '__tmp_dream_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  // Force clean slate
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('Dream Service', () => {
  describe('shouldRunDream', () => {
    it('returns false when no experience entries', async () => {
      await saveDreamConfig('test', { enabled: true, cronHour: 3 });
      const result = await shouldRunDream('test');
      expect(result).toBe(false);
    });

    it('returns true when enabled, has entries, no previous dream', async () => {
      await saveDreamConfig('test', { enabled: true, cronHour: 3 });
      await addEntry('test', { id: 'exp_1', createdAt: '', source: 'edit', rule: '规则一' });
      const result = await shouldRunDream('test');
      expect(result).toBe(true);
    });

    it('returns false when disabled', async () => {
      await saveDreamConfig('test', { enabled: false, cronHour: 3 });
      await addEntry('test', { id: 'exp_1', createdAt: '', source: 'edit', rule: '规则一' });
      const result = await shouldRunDream('test');
      expect(result).toBe(false);
    });
  });

  describe('getDreamConfig', () => {
    it('returns default config when none saved', async () => {
      const config = await getDreamConfig('test');
      expect(config.enabled).toBe(true);
      expect(config.cronHour).toBe(3);
    });
  });

  describe('saveDreamConfig + getDreamConfig', () => {
    it('saves and retrieves config', async () => {
      await saveDreamConfig('test', { enabled: false, cronHour: 5 });
      const config = await getDreamConfig('test');
      expect(config.enabled).toBe(false);
      expect(config.cronHour).toBe(5);
    });
  });

  describe('runDream', () => {
    it('returns null when no experience entries', async () => {
      // Ensure no experience data by explicitly writing empty
      await saveExperience('test', { entries: [] });
      const mockChat = async () => 'optimized rule';
      const report = await runDream('test', mockChat);
      expect(report).toBeNull();
    });

    it('optimizes rules and returns report', async () => {
      await saveExperience('test', {
        entries: [
          { id: 'exp_1', createdAt: '', source: 'edit', rule: '关注设备状态' },
          { id: 'exp_2', createdAt: '', source: 'edit', rule: '设备运行状态需重点关注' },
        ],
      });
      const mockChat = async () => '关注设备运行状态';
      const report = await runDream('test', mockChat);

      expect(report).not.toBeNull();
      expect(report!.optimizedCount).toBe(1);
      expect(report!.originalCount).toBe(2);
    });
  });
});