import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  formatDate,
  formatYearMonth,
  buildHandoverRecord,
  saveHandoverRecord,
  findPendingHandover,
  savePendingHandover,
  removePendingHandover,
} from '../src/services/handover-service';
import { saveChannelsConfig } from '../src/services/config-service';

const TMP_DIR = path.join(__dirname, '__tmp_handover_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
  await saveChannelsConfig({
    platforms: {},
    channels: [
      { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
    ],
  });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('handover-service', () => {
  describe('formatDate / formatYearMonth', () => {
    it('formats date as YYYY-MM-DD', () => {
      const d = new Date('2026-04-17T10:00:00Z');
      const result = formatDate();
      // Just check format pattern, not exact value (depends on timezone)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('formats year-month as YYYY-MM', () => {
      const result = formatYearMonth();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('buildHandoverRecord', () => {
    it('builds record with frontmatter and body (requireAccept=true)', async () => {
      const record = await buildHandoverRecord(
        'qiantai',
        { id: 'u1', name: '张三' },
        { id: 'u2', name: '李四' },
        '# 交接内容\n\n- 事项1',
        { requireAccept: true, createdAt: '2026-04-17T10:00:00Z', completedAt: '2026-04-17T18:00:00Z' }
      );

      expect(record).toContain('---');
      expect(record).toContain('channel_code: qiantai');
      expect(record).toContain('name: 张三');
      expect(record).toContain('name: 李四');
      expect(record).toContain('status: completed');
      expect(record).toContain('require_accept: true');
      expect(record).toContain('completed_at: 2026-04-17T18:00:00Z');
      expect(record).toContain('交接内容');
    });

    it('builds record without receiver when null (requireAccept=false)', async () => {
      const record = await buildHandoverRecord(
        'qiantai',
        { id: 'u1', name: '张三' },
        null,
        '# 交接内容',
        { requireAccept: false, createdAt: '2026-04-17T10:00:00Z' }
      );

      expect(record).toContain('status: archived');
      expect(record).toContain('require_accept: false');
    });
  });

  describe('saveHandoverRecord', () => {
    it('saves handover file in correct directory', async () => {
      const filePath = await saveHandoverRecord('qiantai', 'test.md', '# Test');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('# Test');
    });
  });

  describe('pending handover', () => {
    it('saves and finds pending handover', async () => {
      await savePendingHandover('qiantai', { id: 'u1', name: '张三' }, '交接内容');
      const pending = await findPendingHandover('qiantai');
      expect(pending).not.toBeNull();
      expect(pending!.content).toBe('交接内容');
    });

    it('removes pending handover', async () => {
      await savePendingHandover('qiantai', { id: 'u1', name: '张三' }, '交接内容');
      await removePendingHandover('qiantai');
      expect(await findPendingHandover('qiantai')).toBeNull();
    });
  });
});