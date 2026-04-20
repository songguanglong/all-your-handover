import fs from 'fs/promises';
import path from 'path';
import type { RawRecord } from '../types';
import { getDataDir } from '../utils/data-dir';
import { acquireLock, releaseLock } from '../utils/file-lock';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[draft-raw] record appended');
}

function rawPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts/raw.jsonl`);
}

function draftDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts`);
}

/** Append a raw message record to raw.jsonl (append-only, never modify) */
export async function appendRawRecord(channelCode: string, record: RawRecord): Promise<void> {
  const dp = draftDir(channelCode);
  await fs.mkdir(dp, { recursive: true });
  const p = rawPath(channelCode);
  const line = JSON.stringify(record) + '\n';
  await acquireLock(p);
  try {
    await fs.appendFile(p, line, 'utf-8');
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Read all raw records from raw.jsonl */
export async function readRawRecords(channelCode: string): Promise<RawRecord[]> {
  const p = rawPath(channelCode);
  try {
    const data = await fs.readFile(p, 'utf-8');
    const lines = data.split('\n').filter(Boolean);
    const records: RawRecord[] = [];
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as RawRecord);
      } catch {
        // Skip malformed lines
      }
    }
    return records;
  } catch {
    return [];
  }
}

/** Clear all raw records (used after handover archival) */
export async function clearRawRecords(channelCode: string): Promise<void> {
  const p = rawPath(channelCode);
  await acquireLock(p);
  try {
    await fs.writeFile(p, '', 'utf-8');
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}