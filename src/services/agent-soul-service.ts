import fs from 'fs/promises';
import path from 'path';
import type { AgentSoul, AgentSoulTemplate } from '../types';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[agent-soul] config updated');
}

function soulPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/agent-soul.json`);
}

const BUILTIN_TEMPLATES: AgentSoulTemplate[] = [
  {
    id: 'hotel',
    name: '酒店前台',
    description: '适合酒店前台交接班',
    soul: {
      persona: '你是一位专业的酒店前台交接班助手',
      scenario: 'hotel',
      constraints: ['关注客房状态', '关注宾客特殊需求', '关注待处理事项'],
      tone: '专业、细致',
    },
  },
  {
    id: 'factory',
    name: '工厂车间',
    description: '适合工厂车间交接班',
    soul: {
      persona: '你是一位严谨的工厂车间交接班助手',
      scenario: 'factory',
      constraints: ['关注设备运行状态', '关注安全隐患', '关注生产计划变更'],
      tone: '严谨、务实',
    },
  },
  {
    id: 'hospital',
    name: '医院护士站',
    description: '适合医院护士交接班',
    soul: {
      persona: '你是一位细心的医院护士交接班助手',
      scenario: 'hospital',
      constraints: ['关注患者病情变化', '关注用药和医嘱', '关注特殊护理需求'],
      tone: '细心、规范',
    },
  },
  {
    id: 'custom',
    name: '自定义',
    description: '根据您的场景自定义',
    soul: {
      persona: '你是一位交接班助手',
      scenario: 'custom',
      constraints: [],
      tone: '',
    },
  },
];

const DEFAULT_SOUL: AgentSoul = {
  persona: '你是一位交接班助手',
  scenario: 'custom',
  constraints: [],
  tone: '',
};

export function getTemplates(): AgentSoulTemplate[] {
  return BUILTIN_TEMPLATES;
}

export async function getSoul(channelCode: string): Promise<AgentSoul> {
  try {
    const data = await fs.readFile(soulPath(channelCode), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_SOUL };
  }
}

export async function saveSoul(channelCode: string, soul: AgentSoul): Promise<void> {
  const p = soulPath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(soul, null, 2));
  await autoCommit();
}

export async function resetSoul(channelCode: string): Promise<void> {
  await saveSoul(channelCode, { ...DEFAULT_SOUL });
}

export function buildSoulPrompt(soul: AgentSoul): string {
  const parts: string[] = [];
  parts.push(`【Agent 人设】`);
  parts.push(`角色：${soul.persona}`);
  if (soul.tone) {
    parts.push(`语气：${soul.tone}`);
  }
  if (soul.constraints.length > 0) {
    parts.push(`行为约束：\n${soul.constraints.map(c => `- ${c}`).join('\n')}`);
  }
  if (soul.scenario === 'custom' && soul.customScenario) {
    parts.push(`场景说明：${soul.customScenario}`);
  }
  return parts.join('\n');
}