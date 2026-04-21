import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { handleMessageRecalled } from '../src/services/record-service';
import { readRawRecords } from '../src/services/draft-raw-service';
import { readAnalysis } from '../src/services/draft-analysis-service';
import { readPreview } from '../src/services/draft-preview-service';
import type { RawRecord, AnalysisItem } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_record_retracted_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('handleMessageRecalled', () => {
  it('appends tombstone to raw.jsonl', async () => {
    // Pre-populate a raw record
    const { appendRawRecord } = await import('../src/services/draft-raw-service');
    const record: RawRecord = {
      id: 'msg_001', ts: '2026-04-21T10:00:00Z', sender: 'ou_1',
      sender_name: '张三', type: 'text', content: '测试消息', quoted_context: null,
    };
    await appendRawRecord('test', record);

    await handleMessageRecalled('test', 'msg_001');

    const records = await readRawRecords('test');
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('msg_001');
    expect(records[1].type).toBe('recalled');
    expect(records[1].recalled_msg_id).toBe('msg_001');
  });

  it('marks analysis item as recalled', async () => {
    const { updateAnalysis } = await import('../src/services/draft-analysis-service');
    const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '测试', urgency: 'normal' };
    await updateAnalysis('test', item);

    await handleMessageRecalled('test', 'msg_001');

    const analysis = await readAnalysis('test');
    expect(analysis.items[0].recalled).toBe(true);
  });

  it('removes item from preview.md', async () => {
    const { updateAnalysis } = await import('../src/services/draft-analysis-service');
    const { incrementalUpdatePreview } = await import('../src/services/draft-preview-service');
    const item: AnalysisItem = { msgId: 'msg_001', category: '待办事项', content: '测试', urgency: 'normal' };
    await updateAnalysis('test', item);
    await incrementalUpdatePreview('test', item);

    const previewBefore = await readPreview('test');
    expect(previewBefore).toContain('msg_001');

    await handleMessageRecalled('test', 'msg_001');

    const previewAfter = await readPreview('test');
    expect(previewAfter).not.toContain('msg_001');
  });
});