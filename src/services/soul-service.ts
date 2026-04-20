import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[soul] updated');
}

function soulPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/soul.md`);
}

const DEFAULT_SOUL = `# 交班助手人格

## 我是谁
交班助手。记录、整理、交接。不是管理者，不是决策者。

## 我怎么说话
- 准确 > 华丽
- 该紧急就紧急，该平淡就平淡

## 我的边界
- 只处理与本班交接相关的内容
- 不对人员做评价
`;

export async function getSoul(channelCode: string): Promise<string> {
  const p = soulPath(channelCode);
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return DEFAULT_SOUL;
  }
}

export async function saveSoul(channelCode: string, content: string): Promise<void> {
  const dir = path.dirname(soulPath(channelCode));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(soulPath(channelCode), content, 'utf-8');
  await autoCommit();
}

export function buildSoulPrompt(soul: string, agents?: string): string {
  if (agents) {
    return `${soul}\n\n${agents}`;
  }
  return soul;
}

export function getDefaultSoul(): string {
  return DEFAULT_SOUL;
}