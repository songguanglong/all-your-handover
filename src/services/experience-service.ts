import fs from 'fs/promises';
import path from 'path';
import type { ExperienceEntry, ExperienceFile } from '../types';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[experience] updated');
}

function experiencePath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/experience.json`);
}

function emptyExperience(): ExperienceFile {
  return { entries: [] };
}

export async function getExperience(channelCode: string): Promise<ExperienceFile> {
  try {
    const data = await fs.readFile(experiencePath(channelCode), 'utf-8');
    return JSON.parse(data);
  } catch {
    return emptyExperience();
  }
}

export async function addEntry(channelCode: string, entry: ExperienceEntry): Promise<void> {
  const exp = await getExperience(channelCode);
  exp.entries.push(entry);
  const p = experiencePath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(exp, null, 2));
  await autoCommit();
}

export async function removeEntry(channelCode: string, entryId: string): Promise<void> {
  const exp = await getExperience(channelCode);
  exp.entries = exp.entries.filter(e => e.id !== entryId);
  const p = experiencePath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(exp, null, 2));
  await autoCommit();
}

export async function saveExperience(channelCode: string, exp: ExperienceFile): Promise<void> {
  const p = experiencePath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(exp, null, 2));
  await autoCommit();
}

export function buildExperiencePrompt(experience: ExperienceFile): string | undefined {
  if (experience.entries.length === 0) return undefined;
  const rules = experience.entries.map((e, i) => `${i + 1}. ${e.rule}`).join('\n');
  return `【经验规则】\n以下是从过往交接中积累的经验，请在生成交接班记录时参考：\n${rules}`;
}

export async function analyzeEditIntent(
  channelCode: string,
  llmVersion: string,
  userVersion: string,
  chatCompletion: (messages: Array<{ role: string; content: string }>) => Promise<string>
): Promise<ExperienceEntry | null> {
  if (llmVersion === userVersion) return null;

  const messages = [
    {
      role: 'system' as const,
      content: '你是一个交接班经验分析助手。对比 LLM 生成的交接记录和用户实际编辑的版本，推断用户做这些修改的意图。输出一条简洁的经验规则（一句话），帮助 LLM 以后生成更符合用户期望的交接记录。',
    },
    {
      role: 'user' as const,
      content: `LLM 生成版本：\n${llmVersion}\n\n用户编辑版本：\n${userVersion}\n\n请推断用户的编辑意图，输出一条经验规则：`,
    },
  ];

  try {
    const rule = await chatCompletion(messages);
    const trimmed = rule.trim();
    if (!trimmed) return null;

    return {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source: 'edit',
      rule: trimmed,
      context: `用户编辑了 LLM 生成的交接记录`,
    };
  } catch {
    return null;
  }
}