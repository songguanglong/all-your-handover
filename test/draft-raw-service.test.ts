import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { appendRawRecord, readRawRecords, clearRawRecords } from '../src/services/draft-raw-service';
import type { RawRecord } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_draft_raw_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('Draft Raw Service', () => {
  describe('appendRawRecord + readRawRecords', () => {
    it('appends and reads a single record', async () => {
      const record: RawRecord = {
        id: 'msg_001',
        ts: '2026-04-20T08:30:00Z',
        sender: 'ou_xxx',
        sender_name: '张三',
        type: 'text',
        content: '302房间客人要加床',
        quoted_context: null,
      };
      await appendRawRecord('test', record);
      const records = await readRawRecords('test');
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('msg_001');
      expect(records[0].content).toBe('302房间客人要加床');
    });

    it('appends multiple records in order', async () => {
      const r1: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'hello', quoted_context: null };
      const r2: RawRecord = { id: 'msg_002', ts: '', sender: 'ou_2', sender_name: 'B', type: 'text', content: 'world', quoted_context: null };
      await appendRawRecord('test', r1);
      await appendRawRecord('test', r2);
      const records = await readRawRecords('test');
      expect(records).toHaveLength(2);
      expect(records[0].content).toBe('hello');
      expect(records[1].content).toBe('world');
    });

    it('returns empty array when no records', async () => {
      const records = await readRawRecords('test');
      expect(records).toEqual([]);
    });
  });

  describe('clearRawRecords', () => {
    it('clears all records', async () => {
      const record: RawRecord = { id: 'msg_001', ts: '', sender: 'ou_1', sender_name: 'A', type: 'text', content: 'test', quoted_context: null };
      await appendRawRecord('test', record);
      await clearRawRecords('test');
      const records = await readRawRecords('test');
      expect(records).toEqual([]);
    });
  });
});