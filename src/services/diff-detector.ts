import type { AnalysisItem } from '../types';

export interface DiffEntry {
  type: 'urgency' | 'category' | 'content';
  msgId: string;
  from: string;
  to: string;
  label?: string;  // LLM intent label for content diffs
  timestamp: string;
}

/** Compare two analysis items and return the diffs */
export function detectDiffs(original: AnalysisItem, modified: AnalysisItem): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const now = new Date().toISOString();

  if (original.urgency !== modified.urgency) {
    diffs.push({
      type: 'urgency',
      msgId: original.msgId,
      from: original.urgency,
      to: modified.urgency,
      timestamp: now,
    });
  }

  if (original.category !== modified.category) {
    diffs.push({
      type: 'category',
      msgId: original.msgId,
      from: original.category,
      to: modified.category,
      timestamp: now,
    });
  }

  if (original.content !== modified.content) {
    diffs.push({
      type: 'content',
      msgId: original.msgId,
      from: original.content,
      to: modified.content,
      label: '',  // Will be filled by LLM intent analysis
      timestamp: now,
    });
  }

  return diffs;
}