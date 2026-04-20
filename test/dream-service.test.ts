import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getDreamConfig, saveDreamConfig, calculateModificationRate } from '../src/services/dream-service';

const TMP_DIR = path.join(__dirname, '__tmp_dream_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  await fs.mkdir(path.join(TMP_DIR, 'config'), { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('Dream Service', () => {
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

  describe('calculateModificationRate', () => {
    it('returns 0 when no original items', () => {
      expect(calculateModificationRate(0, 5)).toBe(0);
    });

    it('calculates rate correctly', () => {
      expect(calculateModificationRate(10, 3)).toBe(0.3);
    });

    it('calculates 50% rate', () => {
      expect(calculateModificationRate(10, 5)).toBe(0.5);
    });
  });
});