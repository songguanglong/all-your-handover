import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { readAnalysis, updateAnalysis, clearAnalysis, completenessCheck, markItemRecalled, markItemShift } from '../src/services/draft-analysis-service';
import { appendRawRecord, writeHandoverBoundary } from '../src/services/draft-raw-service';
import type { RawRecord, AnalysisItem } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_draft_analysis_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('Draft Analysis Service', () => {
  describe('readAnalysis', () => {
    it('returns empty analysis when none saved', async () => {
      const analysis = await readAnalysis('test');
      expect(analysis.items).toEqual([]);
      expect(analysis.messageCount).toBe(0);
    });
  });

  describe('updateAnalysis', () => {
    it('adds a new analysis item', async () => {
      const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '302房间加床', urgency: 'normal' };
      await updateAnalysis('test', item);
      const analysis = await readAnalysis('test');
      expect(analysis.items).toHaveLength(1);
      expect(analysis.items[0].msgId).toBe('msg_001');
      expect(analysis.items[0].category).toBe('待办事项');
    });

    it('updates an existing item by msgId', async () => {
      const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '加床', urgency: 'normal' };
      await updateAnalysis('test', item);
      const updated: AnalysisItem = { msgId: 'msg_001', category: '重要事项', content: '302房间加床', urgency: 'high' };
      await updateAnalysis('test', updated);
      const analysis = await readAnalysis('test');
      expect(analysis.items).toHaveLength(1);
      expect(analysis.items[0].category).toBe('重要事项');
      expect(analysis.items[0].urgency).toBe('high');
    });

    it('adds multiple items', async () => {
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'A', urgency: 'normal' });
      await updateAnalysis('test', { msgId: 'msg_002', category: '重要事项', content: 'B', urgency: 'high' });
      const analysis = await readAnalysis('test');
      expect(analysis.items).toHaveLength(2);
    });
  });

  describe('clearAnalysis', () => {
    it('clears all analysis data', async () => {
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'A', urgency: 'normal' });
      const before = await readAnalysis('test');
      expect(before.items).toHaveLength(1);
      await clearAnalysis('test');
      const after = await readAnalysis('test');
      expect(after.items).toEqual([]);
      expect(after.messageCount).toBe(0);
    });
  });

  describe('markItemRecalled', () => {
    it('marks an item as recalled', async () => {
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'A', urgency: 'normal' });
      await markItemRecalled('test', 'msg_001');
      const analysis = await readAnalysis('test');
      expect(analysis.items[0].recalled).toBe(true);
    });
  });

  describe('markItemShift', () => {
    it('marks an item shift to next', async () => {
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'A', urgency: 'normal' });
      await markItemShift('test', 'msg_001', 'next');
      const analysis = await readAnalysis('test');
      expect(analysis.items[0].shift).toBe('next');
    });
  });

  describe('completenessCheck', () => {
    it('returns zero missing when all analyzed', async () => {
      const record: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'test', quoted_context: null };
      await appendRawRecord('test', record);
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'test', urgency: 'normal' });
      const result = await completenessCheck('test');
      expect(result.totalRaw).toBe(1);
      expect(result.totalAnalyzed).toBe(1);
      expect(result.missing).toBe(0);
    });

    it('returns missing count when not all analyzed', async () => {
      const r1: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'a', quoted_context: null };
      const r2: RawRecord = { id: 'msg_002', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'b', quoted_context: null };
      await appendRawRecord('test', r1);
      await appendRawRecord('test', r2);
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'a', urgency: 'normal' });
      const result = await completenessCheck('test');
      expect(result.totalRaw).toBe(2);
      expect(result.totalAnalyzed).toBe(1);
      expect(result.missing).toBe(1);
    });

    it('excludes recalled tombstones and boundary records from raw count', async () => {
      const r1: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'a', quoted_context: null };
      await appendRawRecord('test', r1);
      await writeHandoverBoundary('test');
      const r2: RawRecord = { id: 'msg_002', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'b', quoted_context: null };
      await appendRawRecord('test', r2);
      const tombstone: RawRecord = { id: 'recalled_msg_002', ts: '', sender: '', sender_name: '', type: 'recalled', content: '(消息已撤回)', quoted_context: null, recalled_msg_id: 'msg_002' };
      await appendRawRecord('test', tombstone);

      // Only msg_002 is after the boundary
      const result = await completenessCheck('test');
      expect(result.totalRaw).toBe(1); // only msg_002 (r1 is before boundary, tombstone excluded)
    });

    it('excludes recalled items from analyzed count', async () => {
      const r1: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'a', quoted_context: null };
      await appendRawRecord('test', r1);
      await updateAnalysis('test', { msgId: 'msg_001', category: '待办事项', content: 'a', urgency: 'normal' });
      await markItemRecalled('test', 'msg_001');
      const result = await completenessCheck('test');
      expect(result.totalAnalyzed).toBe(0); // recalled item excluded
      expect(result.totalRaw).toBe(1);
    });
  });
});