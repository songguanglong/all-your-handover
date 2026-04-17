import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  createDraft,
  appendToDraft,
  updateDraftAnalysis,
  readDraft,
  clearDraft,
  parseDraftSections,
} from '../src/services/draft-service';
import { findPendingHandover, savePendingHandover, removePendingHandover } from '../src/services/handover-service';
import { saveChannelsConfig } from '../src/services/config-service';

const TMP_DIR = path.join(__dirname, '__tmp_draft_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
  // Create a channel config so getChannelConfig works
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

describe('draft-service', () => {
  describe('createDraft', () => {
    it('creates a draft with frontmatter and sections', async () => {
      await createDraft('qiantai');
      const draft = await readDraft('qiantai');
      expect(draft).toContain('channel_code: qiantai');
      expect(draft).toContain('## 记录内容');
      expect(draft).toContain('## LLM 整理预览');
    });
  });

  describe('appendToDraft', () => {
    it('auto-creates draft if not exists and appends', async () => {
      await appendToDraft('qiantai', {
        messageId: 'msg_1',
        type: 'text',
        sender: { id: 'u1', name: '张三' },
        rawContent: '301房客人要求延住',
        analysis: null,
        status: 'pending_analysis',
        timestamp: new Date('2026-04-17T10:00:00Z'),
      });

      const draft = await readDraft('qiantai');
      expect(draft).toContain('<!-- msg:msg_1 -->');
      expect(draft).toContain('张三');
      expect(draft).toContain('301房客人要求延住');
    });

    it('appends multiple messages preserving order', async () => {
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender: { id: 'u1', name: '张三' },
        rawContent: '第一条', analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });
      await appendToDraft('qiantai', {
        messageId: 'msg_2', type: 'text', sender: { id: 'u2', name: '李四' },
        rawContent: '第二条', analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      const draft = await readDraft('qiantai');
      const idx1 = draft.indexOf('第一条');
      const idx2 = draft.indexOf('第二条');
      expect(idx1).toBeLessThan(idx2);
    });
  });

  describe('updateDraftAnalysis', () => {
    it('replaces marker with analysis result', async () => {
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender: { id: 'u1', name: '张三' },
        rawContent: '测试内容', analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      await updateDraftAnalysis('qiantai', 'msg_1', {
        category: '客房',
        content: '客人要求延住',
        urgency: 'normal',
      });

      const draft = await readDraft('qiantai');
      expect(draft).toContain('analyzed');
      expect(draft).toContain('客房');
      expect(draft).toContain('客人要求延住');
    });

    it('appends to LLM preview section if marker not found', async () => {
      await createDraft('qiantai');
      await updateDraftAnalysis('qiantai', 'nonexistent_msg', {
        category: '前台',
        content: '测试分析',
        urgency: 'low',
      });

      const draft = await readDraft('qiantai');
      expect(draft).toContain('[前台] 测试分析');
    });
  });

  describe('parseDraftSections', () => {
    it('separates raw records from LLM preview', () => {
      const draft = [
        '# 前台群 - 当前交接草稿',
        '',
        '## 记录内容',
        '',
        '- 10:00 张三: 301延住',
        '- 11:00 李四: 402退房',
        '',
        '## LLM 整理预览',
        '',
        '- [客房] 延住需求',
      ].join('\n');

      const { rawRecords, llmPreview } = parseDraftSections(draft);
      expect(rawRecords).toContain('301延住');
      expect(llmPreview).toContain('[客房]');
    });
  });

  describe('clearDraft', () => {
    it('deletes the draft file', async () => {
      await createDraft('qiantai');
      expect(await readDraft('qiantai')).not.toBeNull();
      await clearDraft('qiantai');
      expect(await readDraft('qiantai')).toBeNull();
    });

    it('does not throw if draft does not exist', async () => {
      await expect(clearDraft('nonexist')).resolves.toBeUndefined();
    });
  });

  describe('pending handover', () => {
    it('saves and finds pending handover', async () => {
      await savePendingHandover('qiantai', { id: 'u1', name: '张三' }, '交接内容');
      const pending = await findPendingHandover('qiantai');
      expect(pending).not.toBeNull();
      expect(pending!.sender).toEqual({ id: 'u1', name: '张三' });
    });

    it('returns null when no pending handover', async () => {
      expect(await findPendingHandover('nonexist')).toBeNull();
    });

    it('removes pending handover', async () => {
      await savePendingHandover('qiantai', { id: 'u1', name: '张三' }, '交接内容');
      await removePendingHandover('qiantai');
      expect(await findPendingHandover('qiantai')).toBeNull();
    });
  });
});