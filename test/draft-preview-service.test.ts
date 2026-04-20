import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { readPreview, updatePreview, incrementalUpdatePreview, clearPreview } from '../src/services/draft-preview-service';
import type { AnalysisItem } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_draft_preview_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('Draft Preview Service', () => {
  describe('readPreview', () => {
    it('returns null when no preview exists', async () => {
      const result = await readPreview('test');
      expect(result).toBeNull();
    });
  });

  describe('updatePreview', () => {
    it('writes and reads preview content', async () => {
      const content = '# 交接班记录\n\n## 待办事项\n\n- 加床 (一般)';
      await updatePreview('test', content);
      const result = await readPreview('test');
      expect(result).toBe(content);
    });

    it('overwrites existing preview', async () => {
      await updatePreview('test', 'old');
      await updatePreview('test', 'new');
      const result = await readPreview('test');
      expect(result).toBe('new');
    });
  });

  describe('incrementalUpdatePreview', () => {
    it('creates initial preview when empty', async () => {
      const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '302房间加床', urgency: 'normal' };
      await incrementalUpdatePreview('test', item);
      const result = await readPreview('test');
      expect(result).toContain('## 待办事项');
      expect(result).toContain('302房间加床');
      expect(result).toContain('一般');
      expect(result).toContain('msg:msg_001');
    });

    it('adds new item to existing category', async () => {
      const item1: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '加床', urgency: 'normal' };
      await incrementalUpdatePreview('test', item1);
      const item2: AnalysisItem = { msgId: 'msg_002', category: '待办事项', content: '换枕套', urgency: 'low' };
      await incrementalUpdatePreview('test', item2);
      const result = await readPreview('test');
      expect(result).toContain('加床');
      expect(result).toContain('换枕套');
    });

    it('adds new category section', async () => {
      const item1: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '加床', urgency: 'normal' };
      await incrementalUpdatePreview('test', item1);
      const item2: AnalysisItem = { msgId: 'msg_002', category: '重要事项', content: 'VIP客人', urgency: 'high' };
      await incrementalUpdatePreview('test', item2);
      const result = await readPreview('test');
      expect(result).toContain('## 待办事项');
      expect(result).toContain('## 重要事项');
      expect(result).toContain('VIP客人');
    });

    it('updates existing item by msgId', async () => {
      const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '加床', urgency: 'normal' };
      await incrementalUpdatePreview('test', item);
      const updated: AnalysisItem = { msgId: 'msg_001', category: '重要事项', content: '302房间加床', urgency: 'high' };
      await incrementalUpdatePreview('test', updated);
      const result = await readPreview('test');
      expect(result).toContain('## 重要事项');
      expect(result).toContain('302房间加床');
      expect(result).toContain('紧急');
    });
  });

  describe('clearPreview', () => {
    it('clears preview content', async () => {
      await updatePreview('test', 'content');
      await clearPreview('test');
      const result = await readPreview('test');
      expect(result).toBe('');
    });
  });
});