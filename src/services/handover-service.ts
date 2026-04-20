import fs from 'fs/promises';
import path from 'path';
import type { HandoverMeta } from '../types';
import { getChannelConfig } from './config-service';
import { v4 as uuid } from 'uuid';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: (message: string) => Promise<void> = () => Promise.resolve();

export function setAutoCommit(fn: (message: string) => Promise<void>): void {
  autoCommitFn = fn;
}

function autoCommit(message: string): void {
  autoCommitFn(message).catch(() => {});
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

export function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// YAML-safe string: quote if contains special chars
function yamlValue(val: string): string {
  if (!val) return '""';
  if (/[:\n\r"',{}[\]#&*!|>'"%`]/.test(val) || val.trim() !== val) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

export async function buildHandoverRecord(
  channelCode: string,
  sender: { id: string; name: string },
  receiver: { id: string; name: string } | null,
  body: string,
  meta: HandoverMeta
): Promise<string> {
  const channelConfig = await getChannelConfig(channelCode);
  const frontmatter = [
    '---',
    `id: hv_${uuid().replace(/-/g, '')}`,
    `channel_code: ${yamlValue(channelCode)}`,
    `channel_name: ${yamlValue(channelConfig?.name ?? channelCode)}`,
    `chat_id: ${yamlValue(channelConfig?.chatId ?? '')}`,
    `created_at: ${meta.createdAt}`,
    `sender:`,
    `  name: ${yamlValue(sender.name)}`,
    `  channel_user_id: ${yamlValue(sender.id)}`,
    `receiver:`,
    `  name: ${yamlValue(receiver?.name ?? '')}`,
    `  channel_user_id: ${yamlValue(receiver?.id ?? '')}`,
    `status: ${meta.requireAccept ? 'completed' : 'archived'}`,
    `require_accept: ${meta.requireAccept}`,
    meta.completedAt ? `completed_at: ${meta.completedAt}` : '',
    '---',
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n${body}`;
}

export async function saveHandoverRecord(
  channelCode: string,
  filename: string,
  record: string
): Promise<string> {
  const monthDir = path.join(getDataDir(), `channels/${channelCode}/handovers/${formatYearMonth()}`);
  await fs.mkdir(monthDir, { recursive: true });
  const filePath = path.join(monthDir, filename);
  await fs.writeFile(filePath, record);
  autoCommit(`[handover] 保存交接记录: ${channelCode}/${filename}`);
  return filePath;
}

export async function findPendingHandover(channelCode: string): Promise<Record<string, unknown> | null> {
  const pp = path.join(getDataDir(), `channels/${channelCode}/drafts/pending.json`);
  try {
    const data = await fs.readFile(pp, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function savePendingHandover(
  channelCode: string,
  sender: { id: string; name: string },
  content: string
): Promise<void> {
  const dir = path.join(getDataDir(), `channels/${channelCode}/drafts`);
  await fs.mkdir(dir, { recursive: true });

  const data = {
    channelCode,
    sender: { id: sender.id, name: sender.name },
    content,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, 'pending.json'), JSON.stringify(data, null, 2));
  autoCommit(`[handover] 保存待交接: ${channelCode}`);
}

export async function removePendingHandover(channelCode: string): Promise<void> {
  const pp = path.join(getDataDir(), `channels/${channelCode}/drafts/pending.json`);
  try {
    await fs.unlink(pp);
    autoCommit(`[handover] 取消待交接: ${channelCode}`);
  } catch {
    // already deleted
  }
}