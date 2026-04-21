import fs from 'fs/promises';
import path from 'path';
import type { DiffEntry } from './diff-detector';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[channel-memory] updated');
}

function memoryPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/channel-memory.md`);
}

function candidatesPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/dreaming/candidates.json`);
}

function dreamingDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/dreaming`);
}

interface CandidateEntry {
  id: string;
  field: 'urgency' | 'category' | 'content';
  from: string;
  to: string;
  label?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

interface CandidatesFile {
  entries: CandidateEntry[];
}

// Candidates older than 30 days with count < 2 are pruned on each write
const CANDIDATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_MEMORY = `# 渠道记忆

## 用户偏好

## 模式识别

## 纠错记录

## 禁忌
`;

export async function getChannelMemory(channelCode: string): Promise<string> {
  const p = memoryPath(channelCode);
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return DEFAULT_MEMORY;
  }
}

export async function saveChannelMemory(channelCode: string, content: string): Promise<void> {
  const dir = path.dirname(memoryPath(channelCode));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(memoryPath(channelCode), content, 'utf-8');
  await autoCommit();
}

/** Extract only the "纠错记录" and "禁忌" sections from memory for prompt injection */
export function extractMemoryForPrompt(memory: string): string {
  const sections: string[] = [];

  const errorMatch = memory.match(/## 纠错记录\n([\s\S]*?)(?=\n## |\n*$)/);
  if (errorMatch && errorMatch[1].trim()) {
    sections.push(`## 纠错记录\n${errorMatch[1].trim()}`);
  }

  const tabooMatch = memory.match(/## 禁忌\n([\s\S]*?)(?=\n## |\n*$)/);
  if (tabooMatch && tabooMatch[1].trim()) {
    sections.push(`## 禁忌\n${tabooMatch[1].trim()}`);
  }

  return sections.length > 0 ? `【渠道记忆】\n${sections.join('\n\n')}` : '';
}

/** Record a diff as a candidate correction */
export async function recordDiffCandidate(channelCode: string, diff: DiffEntry): Promise<void> {
  const dir = dreamingDir(channelCode);
  await fs.mkdir(dir, { recursive: true });
  const p = candidatesPath(channelCode);

  let file: CandidatesFile;
  try {
    const data = await fs.readFile(p, 'utf-8');
    file = JSON.parse(data) as CandidatesFile;
    // Prune stale candidates (older than 30 days with count < 2)
    const cutoff = Date.now() - CANDIDATE_TTL_MS;
    file.entries = file.entries.filter(e => {
      const seen = new Date(e.lastSeen).getTime();
      return e.count >= 2 || seen > cutoff;
    });
  } catch {
    file = { entries: [] };
  }

  // Check for same-type candidate
  const existing = findSameTypeCandidate(file.entries, diff);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = diff.timestamp;
    // Update label if this is a content diff with a new label
    if (diff.type === 'content' && diff.label) {
      existing.label = diff.label;
    }
  } else {
    file.entries.push({
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      field: diff.type,
      from: diff.from,
      to: diff.to,
      label: diff.label,
      count: 1,
      firstSeen: diff.timestamp,
      lastSeen: diff.timestamp,
    });
  }

  await fs.writeFile(p, JSON.stringify(file, null, 2), 'utf-8');
  await autoCommit();

  // If count >= 2, auto-write to channel-memory.md
  if (existing && existing.count >= 2) {
    await writeCandidateToMemory(channelCode, existing);
    // Remove from candidates after writing
    file.entries = file.entries.filter(e => e.id !== existing.id);
    await fs.writeFile(p, JSON.stringify(file, null, 2), 'utf-8');
  }
}

/** Same-type detection: field+direction for urgency/category, label match for content */
function findSameTypeCandidate(entries: CandidateEntry[], diff: DiffEntry): CandidateEntry | undefined {
  return entries.find(e => {
    if (e.field !== diff.type) return false;

    if (diff.type === 'urgency' || diff.type === 'category') {
      // Same field + same direction (from → to)
      return e.from === diff.from && e.to === diff.to;
    }

    // For content: same label (if available)
    if (diff.type === 'content' && e.label && diff.label) {
      return e.label === diff.label;
    }

    return false;
  });
}

/** Write an approved candidate to channel-memory.md */
async function writeCandidateToMemory(channelCode: string, candidate: CandidateEntry): Promise<void> {
  let memory = await getChannelMemory(channelCode);

  const date = candidate.lastSeen.split('T')[0];

  if (candidate.field === 'urgency') {
    const line = `- ${date}：${candidate.from}优先级应标"${candidate.to}"，之前标"${candidate.from}"已纠正`;
    memory = appendToSection(memory, '纠错记录', line);
  } else if (candidate.field === 'category') {
    const line = `- ${date}：分类"${candidate.from}"应改为"${candidate.to}"`;
    memory = appendToSection(memory, '纠错记录', line);
  } else if (candidate.field === 'content' && candidate.label) {
    const line = `- ${date}：${candidate.label}`;
    memory = appendToSection(memory, '纠错记录', line);
  }

  await saveChannelMemory(channelCode, memory);
}

function appendToSection(memory: string, sectionName: string, line: string): string {
  const sectionRegex = new RegExp(`(## ${sectionName}\\n)`);
  if (sectionRegex.test(memory)) {
    return memory.replace(sectionRegex, `$1${line}\n`);
  }
  // Section doesn't exist, append it
  return memory.trimEnd() + `\n\n## ${sectionName}\n\n${line}\n`;
}

/** Read candidates file */
export async function readCandidates(channelCode: string): Promise<CandidatesFile> {
  const p = candidatesPath(channelCode);
  try {
    const data = await fs.readFile(p, 'utf-8');
    return JSON.parse(data) as CandidatesFile;
  } catch {
    return { entries: [] };
  }
}