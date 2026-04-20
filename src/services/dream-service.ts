import fs from 'fs/promises';
import path from 'path';
import type { DreamConfig, ExperienceFile, ExperienceEntry } from '../types';
import { getDataDir } from '../utils/data-dir';
import { getExperience, saveExperience } from './experience-service';

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

export interface DreamReport {
  originalCount: number;
  optimizedCount: number;
  optimizedRules: string[];
  removed: string[];
}

export async function runDream(
  channelCode: string,
  chatCompletion: (messages: Array<{ role: string; content: string }>) => Promise<string>
): Promise<DreamReport | null> {
  const exp = await getExperience(channelCode);
  if (exp.entries.length === 0) return null;

  const rulesList = exp.entries.map((e, i) => `${i + 1}. [${e.source}] ${e.rule}`).join('\n');

  const messages = [
    {
      role: 'system' as const,
      content: '你是一个交接班经验规则优化助手。审视所有经验规则，识别重复、矛盾、可合并的规则，提炼更高层规律。输出优化后的规则列表，每行一条，以 "规则内容" 格式输出。不要编号，不要解释。',
    },
    {
      role: 'user' as const,
      content: `当前经验规则：\n${rulesList}\n\n请优化这些规则，去除重复，合并相关项，提炼更高层规律：`,
    },
  ];

  try {
    const result = await chatCompletion(messages);
    const optimizedRules = result.trim().split('\n').map(l => l.trim()).filter(Boolean);

    const originalRules = exp.entries.map(e => e.rule);
    const removed = originalRules.filter(r => !optimizedRules.some(o => o.includes(r) || r.includes(o)));

    const newEntries: ExperienceEntry[] = optimizedRules.map(rule => ({
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source: 'dream' as const,
      rule,
      context: '由深度反思优化生成',
    }));

    exp.entries = newEntries;
    exp.lastDreamAt = new Date().toISOString();
    await saveExperience(channelCode, exp);

    return {
      originalCount: originalRules.length,
      optimizedCount: optimizedRules.length,
      optimizedRules,
      removed,
    };
  } catch {
    return null;
  }
}

export async function shouldRunDream(channelCode: string): Promise<boolean> {
  const config = await getDreamConfig(channelCode);
  if (!config.enabled) return false;

  const exp = await getExperience(channelCode);
  if (exp.entries.length === 0) return false;

  if (!exp.lastDreamAt) return true;

  const lastDream = new Date(exp.lastDreamAt);
  const now = new Date();
  return lastDream.toDateString() !== now.toDateString();
}