import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getLatestHandover } from '../src/services/context-service';

describe('context-service', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ayh-ctx-'));
    process.env.DATA_DIR = tmpDir;
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeHandover(channelCode: string, month: string, filename: string, id: string, date: string, body: string) {
    const dir = path.join(tmpDir, `channels/${channelCode}/handovers/${month}`);
    await fs.mkdir(dir, { recursive: true });
    const content = `---\nid: ${id}\ncreated_at: ${date}\ncompleted_at: ${date}\n---\n\n${body}`;
    await fs.writeFile(path.join(dir, filename), content);
  }

  it('returns null when no handovers exist', async () => {
    const result = await getLatestHandover('test');
    expect(result).toBeNull();
  });

  it('finds the latest handover in a single month', async () => {
    await writeHandover('test', '2026-04', '2026-04-17_ou_a_ou_b.md', 'hv_001', '2026-04-17T08:00:00Z', '上一班内容 A');
    await writeHandover('test', '2026-04', '2026-04-18_ou_b_ou_c.md', 'hv_002', '2026-04-18T08:00:00Z', '上一班内容 B');

    const result = await getLatestHandover('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('hv_002');
    expect(result!.body).toBe('上一班内容 B');
  });

  it('finds the latest handover across months', async () => {
    await writeHandover('test', '2026-03', '2026-03-31_ou_x_ou_y.md', 'hv_old', '2026-03-31T08:00:00Z', '三月交接');
    await writeHandover('test', '2026-04', '2026-04-01_ou_y_ou_z.md', 'hv_new', '2026-04-01T08:00:00Z', '四月交接');

    const result = await getLatestHandover('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('hv_new');
    expect(result!.body).toBe('四月交接');
  });

  it('skips files with empty body', async () => {
    await writeHandover('test', '2026-04', '2026-04-18_ou_a_ou_b.md', 'hv_empty', '2026-04-18T08:00:00Z', '');
    await writeHandover('test', '2026-04', '2026-04-17_ou_x_ou_y.md', 'hv_has_body', '2026-04-17T08:00:00Z', '有内容');

    const result = await getLatestHandover('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('hv_has_body');
  });

  it('extracts date from completed_at', async () => {
    await writeHandover('test', '2026-04', '2026-04-18_ou_a_ou_b.md', 'hv_003', '2026-04-18T16:30:00Z', '内容');
    const result = await getLatestHandover('test');
    expect(result!.date).toBe('2026-04-18T16:30:00Z');
  });
});