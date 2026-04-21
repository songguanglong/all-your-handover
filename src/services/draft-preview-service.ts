import fs from 'fs/promises';
import path from 'path';
import type { AnalysisItem } from '../types';
import { getDataDir } from '../utils/data-dir';
import { acquireLock, releaseLock } from '../utils/file-lock';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[draft-preview] updated');
}

function previewPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts/preview.md`);
}

function previewItemsPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts/preview-items.json`);
}

function draftDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/drafts`);
}

interface PreviewItemsFile {
  items: AnalysisItem[];
}

async function readPreviewItems(channelCode: string): Promise<PreviewItemsFile> {
  try {
    const data = await fs.readFile(previewItemsPath(channelCode), 'utf-8');
    return JSON.parse(data) as PreviewItemsFile;
  } catch {
    return { items: [] };
  }
}

async function writePreviewItems(channelCode: string, file: PreviewItemsFile): Promise<void> {
  await fs.mkdir(draftDir(channelCode), { recursive: true });
  await fs.writeFile(previewItemsPath(channelCode), JSON.stringify(file, null, 2), 'utf-8');
}

/** Read the preview.md content */
export async function readPreview(channelCode: string): Promise<string | null> {
  const p = previewPath(channelCode);
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

/** Full replacement of preview.md content, reconciles preview-items.json */
export async function updatePreview(channelCode: string, content: string): Promise<void> {
  const dp = draftDir(channelCode);
  await fs.mkdir(dp, { recursive: true });
  const p = previewPath(channelCode);

  // Reconcile preview-items.json with markers still present in new content
  // (do this OUTSIDE the preview lock to avoid nested locking with analysis)
  const itemsFile = await readPreviewItems(channelCode);
  const markerRegex = /<!-- msg:([a-zA-Z0-9_-]+) -->/g;
  const remainingMsgIds = new Set<string>();
  let match;
  while ((match = markerRegex.exec(content)) !== null) {
    remainingMsgIds.add(match[1]);
  }
  itemsFile.items = itemsFile.items.filter(i => remainingMsgIds.has(i.msgId));

  // If user removed a marker, that's intentional — don't auto-restore.
  // New items arriving during editing are handled by the H5 assign-shift flow.

  await acquireLock(p);
  try {
    await fs.writeFile(p, content, 'utf-8');
    await writePreviewItems(channelCode, itemsFile);
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Remove an item's line from preview.md (used when assigning message to next shift) */
export async function removeItemFromPreview(channelCode: string, msgId: string): Promise<void> {
  const p = previewPath(channelCode);
  await acquireLock(p);
  try {
    let preview: string;
    try {
      preview = await fs.readFile(p, 'utf-8');
    } catch {
      return; // No preview to modify
    }

    // Remove the line containing this msgId marker
    const lines = preview.split('\n');
    const filteredLines = lines.filter(line => line.includes(`<!-- msg:${msgId} -->`));
    if (filteredLines.length === 0) {
      releaseLock(p);
      return; // Item not in preview
    }

    // Remove lines containing this marker
    const newPreview = lines
      .filter(line => !line.includes(`<!-- msg:${msgId} -->`))
      .join('\n');

    // Clean up empty sections (## Section with no items below)
    const cleaned = cleanEmptySections(newPreview);
    await fs.writeFile(p, cleaned, 'utf-8');

    // Remove from preview-items.json
    const itemsFile = await readPreviewItems(channelCode);
    itemsFile.items = itemsFile.items.filter(i => i.msgId !== msgId);
    await writePreviewItems(channelCode, itemsFile);
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Remove empty sections (## Section with no content below) from preview */
function cleanEmptySections(preview: string): string {
  const lines = preview.split('\n');
  const result: string[] = [];
  let skipEmptySection = false;
  let sectionHasContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) {
      // Check if this section has any content (not just list items)
      sectionHasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^## /.test(lines[j])) break;
        if (lines[j].trim() !== '') {
          sectionHasContent = true;
          break;
        }
      }
      if (!sectionHasContent) {
        skipEmptySection = true;
        continue;
      }
      skipEmptySection = false;
      result.push(line);
    } else if (skipEmptySection) {
      // Skip blank lines after empty section header
      if (line.trim() === '') continue;
      skipEmptySection = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Incremental update: insert or update a single analysis item in preview.md.
 * Finds the section matching the item's category, adds/updates the entry there.
 * Also updates preview-items.json for robust tracking.
 */
export async function incrementalUpdatePreview(channelCode: string, item: AnalysisItem): Promise<void> {
  const dp = draftDir(channelCode);
  await fs.mkdir(dp, { recursive: true });
  const p = previewPath(channelCode);

  await acquireLock(p);
  try {
    let preview: string;
    try {
      preview = await fs.readFile(p, 'utf-8');
    } catch {
      preview = '';
    }

    const updated = applyIncrementalUpdate(preview, item);
    await fs.writeFile(p, updated, 'utf-8');

    // Update preview-items.json
    const itemsFile = await readPreviewItems(channelCode);
    const idx = itemsFile.items.findIndex(i => i.msgId === item.msgId);
    if (idx >= 0) {
      itemsFile.items[idx] = item;
    } else {
      itemsFile.items.push(item);
    }
    await writePreviewItems(channelCode, itemsFile);
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

/** Clear preview.md and preview-items.json (used after handover archival) */
export async function clearPreview(channelCode: string): Promise<void> {
  const p = previewPath(channelCode);
  await acquireLock(p);
  try {
    await fs.writeFile(p, '', 'utf-8');
    await writePreviewItems(channelCode, { items: [] });
  } finally {
    releaseLock(p);
  }
  await autoCommit();
}

// --- Internal helpers ---

const URGENCY_LABEL: Record<string, string> = {
  high: '紧急',
  normal: '一般',
  low: '低',
};

function formatItem(item: AnalysisItem): string {
  const urgency = URGENCY_LABEL[item.urgency] ?? '一般';
  return `- ${item.content} (${urgency})`;
}

function applyIncrementalUpdate(preview: string, item: AnalysisItem): string {
  const category = item.category;
  const itemLine = formatItem(item);

  // If preview is empty, create initial structure
  if (!preview.trim()) {
    return `# 交接班记录\n\n## ${category}\n\n${itemLine} <!-- msg:${item.msgId} -->\n`;
  }

  const sectionRegex = new RegExp(`^## ${escapeRegex(category)}\\s*$`, 'm');
  const sectionMatch = sectionRegex.test(preview);

  if (sectionMatch) {
    // Category section exists — check if msgId marker is present
    const markerRegex = new RegExp(
      `^(- .+ \\(${escapeRegex(URGENCY_LABEL[item.urgency] ?? '一般')}\\)) <!-- msg:${escapeRegex(item.msgId)} -->$`,
      'm'
    );
    const existingWithAnyUrgency = new RegExp(
      `^- .+ \\(.*?\\) <!-- msg:${escapeRegex(item.msgId)} -->$`,
      'm'
    );

    if (existingWithAnyUrgency.test(preview)) {
      // Update existing entry for this msgId
      preview = preview.replace(existingWithAnyUrgency, `${itemLine} <!-- msg:${item.msgId} -->`);
    } else {
      // Append to this category section
      const sectionStart = preview.indexOf(`## ${category}`);
      const nextSection = preview.indexOf('\n## ', sectionStart + 1);
      const insertPos = nextSection >= 0 ? nextSection : preview.length;

      const before = preview.slice(0, insertPos).trimEnd();
      const after = preview.slice(insertPos);
      preview = `${before}\n${itemLine} <!-- msg:${item.msgId} -->\n${after}`;
    }
  } else {
    // Category section doesn't exist — append new section
    preview = preview.trimEnd() + `\n\n## ${category}\n\n${itemLine} <!-- msg:${item.msgId} -->\n`;
  }

  return preview;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}