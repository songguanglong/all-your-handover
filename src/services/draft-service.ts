import fs from 'fs/promises';
import path from 'path';
import type { DraftRecord, AnalyzeResult } from '../types';
import { logger } from '../utils/logger';
import { getChannelConfig } from './config-service';
import { releaseLock, acquireLock } from '../utils/file-lock';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: (message: string) => Promise<void>): void {
  autoCommitFn = fn;
}

function autoCommit(message: string): void {
  if (autoCommitFn) autoCommitFn(message).catch(() => {});
}

function draftPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts/ongoing.md`);
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Sanitize user input to prevent markdown injection
function sanitizeForMarkdown(text: string): string {
  // Remove markdown section headers and HTML comments that could break draft structure
  return text
    .replace(/^##\s/gm, '# # ')   // Escape section headers
    .replace(/<!--/g, '< !--')    // Break HTML comment markers
    .replace(/-->/g, '-- >');
}

// --- Draft CRUD ---

export async function createDraft(channelCode: string): Promise<void> {
  const dir = path.dirname(draftPath(channelCode));
  await fs.mkdir(dir, { recursive: true });

  const channelConfig = await getChannelConfig(channelCode);
  const channelDisplayName = channelConfig?.name ?? channelCode;
  const now = new Date().toISOString();

  const content = [
    '---',
    `channel_code: ${channelCode}`,
    `channel_name: ${channelDisplayName}`,
    `started_at: ${now}`,
    `updated_at: ${now}`,
    '---',
    '',
    `# ${channelDisplayName} - 当前交接草稿`,
    '',
    '## 记录内容',
    '',
    '## LLM 整理预览',
    '',
  ].join('\n');

  await fs.writeFile(draftPath(channelCode), content);
  autoCommit(`[draft] 创建草稿: ${channelCode}`);
}

export async function appendToDraft(channelCode: string, record: DraftRecord): Promise<void> {
  const dp = draftPath(channelCode);

  await acquireLock(channelCode);
  try {
    // Check existence inside the lock to avoid TOCTOU
    let exists = false;
    try {
      await fs.access(dp);
      exists = true;
    } catch {
      // file doesn't exist
    }

    if (!exists) {
      await createDraft(channelCode);
    }

    let draft = await fs.readFile(dp, 'utf-8');

    const safeName = sanitizeForMarkdown(record.sender.name);
    const safeContent = sanitizeForMarkdown(record.rawContent);
    const recordLine = `<!-- msg:${record.messageId} -->- ${formatTime(record.timestamp)} ${safeName}: ${safeContent}\n`;

    // Insert before "## LLM 整理预览" section
    const previewIdx = draft.indexOf('\n## LLM 整理预览');
    if (previewIdx !== -1) {
      draft = draft.substring(0, previewIdx) + '\n' + recordLine + draft.substring(previewIdx);
    } else {
      draft += recordLine;
    }

    await fs.writeFile(dp, draft);
    autoCommit(`[draft] 追加记录: ${channelCode}`);
  } finally {
    releaseLock(channelCode);
  }
}

export async function updateDraftAnalysis(
  channelCode: string,
  messageId: string,
  analysis: AnalyzeResult
): Promise<void> {
  const dp = draftPath(channelCode);

  await acquireLock(channelCode);
  try {
    let draft: string;
    try {
      draft = await fs.readFile(dp, 'utf-8');
    } catch {
      return;
    }

    const marker = `<!-- msg:${messageId} -->`;
    if (draft.includes(marker)) {
      draft = draft.replace(
        marker,
        `${marker}analyzed\n  > 分析: ${sanitizeForMarkdown(analysis.category)} | ${sanitizeForMarkdown(analysis.content)} | 紧急: ${analysis.urgency}`
      );
    } else {
      const previewSection = '## LLM 整理预览';
      const previewEntry = `- [${sanitizeForMarkdown(analysis.category)}] ${sanitizeForMarkdown(analysis.content)} (紧急: ${analysis.urgency})`;
      if (draft.includes(previewSection)) {
        draft = draft.replace(previewSection, `${previewSection}\n${previewEntry}`);
      } else {
        draft += `\n${previewSection}\n${previewEntry}\n`;
      }
    }

    await fs.writeFile(dp, draft);
  } finally {
    releaseLock(channelCode);
  }
}

export async function readDraft(channelCode: string): Promise<string | null> {
  try {
    return await fs.readFile(draftPath(channelCode), 'utf-8');
  } catch {
    return null;
  }
}

export async function clearDraft(channelCode: string): Promise<void> {
  try {
    await fs.unlink(draftPath(channelCode));
    autoCommit(`[draft] 清除草稿: ${channelCode}`);
  } catch {
    // already deleted or never existed
  }
}

export function parseDraftSections(draft: string): { rawRecords: string; llmPreview: string } {
  const sections = draft.split(/^## /m);
  let rawRecords = '';
  let llmPreview = '';
  for (const section of sections) {
    if (section.startsWith('记录内容')) {
      rawRecords = section.replace(/^记录内容\n?/, '').trim();
    } else if (section.startsWith('LLM 整理预览')) {
      llmPreview = section.replace(/^LLM 整理预览\n?/, '').trim();
    }
  }
  return { rawRecords, llmPreview };
}