import fs from 'fs/promises';
import path from 'path';
import type { AnalysisFile, AnalysisItem, CompletenessCheckResult } from '../types';
import { getDataDir } from '../utils/data-dir';
import { acquireLock, releaseLock } from '../utils/file-lock';
import { readRawRecords } from './draft-raw-service';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[draft-analysis] updated');
}

function analysisPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts/analysis.json`);
}

function draftDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts`);
}

function emptyAnalysis(): AnalysisFile {
  return { lastUpdated: '', messageCount: 0, items: [] };
}

/** Read the analysis file */
export async function readAnalysis(channelCode: string): Promise<AnalysisFile> {
  const p = analysisPath(channelCode);
  try {
    const data = await fs.readFile(p, 'utf-8');
    return JSON.parse(data) as AnalysisFile;
  } catch {
    return emptyAnalysis();
  }
}

/** Add or update a single analysis item by msgId */
export async function updateAnalysis(channelCode: string, item: AnalysisItem): Promise<void> {
  const dp = draftDir(channelCode);
  await fs.mkdir(dp, { recursive: true });
  const p = analysisPath(channelCode);

  await acquireLock(p);
  try {
    let file: AnalysisFile;
    try {
      const data = await fs.readFile(p, 'utf-8');
      file = JSON.parse(data) as AnalysisFile;
    } catch {
      file = emptyAnalysis();
    }

    // Preserve analyzedAt if not provided
    if (!item.analyzedAt) {
      item.analyzedAt = new Date().toISOString();
    }
    // Default shift to 'current'
    if (!item.shift) {
      item.shift = 'current';
    }

    const idx = file.items.findIndex(i => i.msgId === item.msgId);
    if (idx >= 0) {
      file.items[idx] = item;
    } else {
      file.items.push(item);
    }
    file.lastUpdated = new Date().toISOString();
    file.messageCount = file.items.length;

    await fs.writeFile(p, JSON.stringify(file, null, 2), 'utf-8');
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Mark an analysis item's shift assignment (current or next) */
export async function markItemShift(channelCode: string, msgId: string, shift: 'current' | 'next'): Promise<void> {
  const p = analysisPath(channelCode);
  await acquireLock(p);
  try {
    let file: AnalysisFile;
    try {
      const data = await fs.readFile(p, 'utf-8');
      file = JSON.parse(data) as AnalysisFile;
    } catch {
      file = emptyAnalysis();
    }

    const idx = file.items.findIndex(i => i.msgId === msgId);
    if (idx >= 0) {
      file.items[idx].shift = shift;
      file.lastUpdated = new Date().toISOString();
      await fs.writeFile(p, JSON.stringify(file, null, 2), 'utf-8');
    }
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Mark an analysis item as recalled (message was retracted by sender) */
export async function markItemRecalled(channelCode: string, msgId: string): Promise<void> {
  const p = analysisPath(channelCode);
  await acquireLock(p);
  try {
    let file: AnalysisFile;
    try {
      const data = await fs.readFile(p, 'utf-8');
      file = JSON.parse(data) as AnalysisFile;
    } catch {
      file = emptyAnalysis();
    }

    const idx = file.items.findIndex(i => i.msgId === msgId);
    if (idx >= 0) {
      file.items[idx].recalled = true;
      file.lastUpdated = new Date().toISOString();
      await fs.writeFile(p, JSON.stringify(file, null, 2), 'utf-8');
    }
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Clear all analysis data (used after handover archival) */
export async function clearAnalysis(channelCode: string): Promise<void> {
  const p = analysisPath(channelCode);
  await acquireLock(p);
  try {
    await fs.writeFile(p, JSON.stringify(emptyAnalysis(), null, 2), 'utf-8');
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Check completeness: raw records vs analyzed items (excludes recalled & boundary records) */
export async function completenessCheck(channelCode: string): Promise<CompletenessCheckResult> {
  const [rawRecords, analysis] = await Promise.all([
    readRawRecords(channelCode),
    readAnalysis(channelCode),
  ]);

  // Only count real message records after the last handover boundary (exclude recalled tombstones and boundaries)
  let lastBoundaryIdx = -1;
  for (let i = rawRecords.length - 1; i >= 0; i--) {
    if (rawRecords[i].type === 'handover_boundary') {
      lastBoundaryIdx = i;
      break;
    }
  }
  const relevantRecords = rawRecords.filter((r, i) =>
    i > lastBoundaryIdx && r.type !== 'recalled' && r.type !== 'handover_boundary'
  );

  const activeItems = analysis.items.filter(i => !i.recalled);
  const totalRaw = relevantRecords.length;
  const totalAnalyzed = activeItems.length;
  return {
    totalRaw,
    totalAnalyzed,
    missing: Math.max(0, totalRaw - totalAnalyzed),
  };
}