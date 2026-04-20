import fs from 'fs/promises';
import path from 'path';
import type { DreamConfig } from '../types';
import { getDataDir } from '../utils/data-dir';
import { logger } from '../utils/logger';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[dream] config updated');
}

function dreamConfigPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/dream-config.json`);
}

function reviewsDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/dreaming/reviews`);
}

const DEFAULT_DREAM_CONFIG: DreamConfig = { enabled: true, cronHour: 3 };

export async function getDreamConfig(channelCode: string): Promise<DreamConfig> {
  try {
    const data = await fs.readFile(dreamConfigPath(channelCode), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_DREAM_CONFIG };
  }
}

export async function saveDreamConfig(channelCode: string, config: DreamConfig): Promise<void> {
  const p = dreamConfigPath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(config, null, 2));
  await autoCommit();
}

export interface DreamCandidate {
  id: string;
  content: string;
  section: '用户偏好' | '模式识别' | '纠错记录' | '禁忌';
  confidence: number;
}

export interface DreamReport {
  modificationRate: number;
  candidatesGenerated: number;
  autoWritten: number;
  pendingReview: number;
}

/** Calculate modification rate from diff counts */
export function calculateModificationRate(originalCount: number, modifiedCount: number): number {
  if (originalCount === 0) return 0;
  return modifiedCount / originalCount;
}

/**
 * Run post-handover dream (review) when modification rate > 30%.
 * Returns null if not triggered.
 */
export async function runPostHandoverDream(
  channelCode: string,
  modificationRate: number,
  chatCompletion: (messages: Array<{ role: string; content: string }>) => Promise<string>
): Promise<DreamReport | null> {
  const config = await getDreamConfig(channelCode);
  if (!config.enabled) return null;

  // Only trigger if modification rate > 30%
  if (modificationRate <= 0.3) return null;

  // Read channel memory and recent handovers for context
  const { getChannelMemory } = await import('./channel-memory-service');
  const memory = await getChannelMemory(channelCode);

  const messages = [
    {
      role: 'system' as const,
      content: `你是一个交接班复盘助手。根据交接记录的修改情况和渠道记忆，生成候选记忆条目。
每条候选记忆包含：内容、所属section（用户偏好/模式识别/纠错记录/禁忌）、置信度（0-1）。
输出JSON数组，格式：[{"content":"...","section":"...","confidence":0.9}]`,
    },
    {
      role: 'user' as const,
      content: `交接记录修改率: ${(modificationRate * 100).toFixed(0)}%\n\n渠道记忆：\n${memory}\n\n请分析并生成候选记忆条目：`,
    },
  ];

  try {
    const result = await chatCompletion(messages);
    const candidates = parseDreamCandidates(result);
    const report = await processCandidates(channelCode, candidates);

    // Save review record
    await saveReviewRecord(channelCode, modificationRate, candidates);

    return report;
  } catch (err) {
    logger.error(`Dream review failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function parseDreamCandidates(raw: string): DreamCandidate[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: Record<string, unknown>) =>
        typeof item.content === 'string' &&
        typeof item.section === 'string' &&
        typeof item.confidence === 'number'
      )
      .map((item: Record<string, unknown>, i: number) => ({
        id: `d_${Date.now()}_${i}`,
        content: item.content as string,
        section: item.section as DreamCandidate['section'],
        confidence: item.confidence as number,
      }));
  } catch {
    return [];
  }
}

async function processCandidates(channelCode: string, candidates: DreamCandidate[]): Promise<DreamReport> {
  const { saveChannelMemory, getChannelMemory } = await import('./channel-memory-service');
  const memory = await getChannelMemory(channelCode);
  let autoWritten = 0;
  let pendingReview = 0;

  for (const candidate of candidates) {
    if (candidate.confidence >= 0.8) {
      // Auto-write to memory
      const line = `- ${candidate.content}`;
      const updatedMemory = appendToMemorySection(memory, candidate.section, line);
      await saveChannelMemory(channelCode, updatedMemory);
      autoWritten++;
    } else {
      pendingReview++;
    }
  }

  return {
    modificationRate: 0,
    candidatesGenerated: candidates.length,
    autoWritten,
    pendingReview,
  };
}

function appendToMemorySection(memory: string, section: string, line: string): string {
  const sectionRegex = new RegExp(`(## ${section}\\n)`);
  if (sectionRegex.test(memory)) {
    return memory.replace(sectionRegex, `$1${line}\n`);
  }
  return memory.trimEnd() + `\n\n## ${section}\n\n${line}\n`;
}

async function saveReviewRecord(channelCode: string, modificationRate: number, candidates: DreamCandidate[]): Promise<void> {
  const dir = reviewsDir(channelCode);
  await fs.mkdir(dir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(dir, `${date}.md`);

  const content = `# 复盘记录 ${date}

## 修改率
${(modificationRate * 100).toFixed(0)}%

## 候选条目
${candidates.map(c => `- [${c.confidence >= 0.8 ? '已写入' : '待审'}] (${c.section}, confidence: ${c.confidence}) ${c.content}`).join('\n')}
`;

  await fs.writeFile(filePath, content, 'utf-8');
  await autoCommit();
}

// Legacy compatibility — no longer used by scheduler
export async function shouldRunDream(_channelCode: string): Promise<boolean> {
  return false;
}

export async function runDream(
  channelCode: string,
  chatCompletion: (messages: Array<{ role: string; content: string }>) => Promise<string>
): Promise<DreamReport | null> {
  return runPostHandoverDream(channelCode, 0.5, chatCompletion);
}