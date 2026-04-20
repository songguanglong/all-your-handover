import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../utils/data-dir';

let autoCommitFn: ((message: string) => Promise<void>) | null = null;

export function setAutoCommit(fn: ((message: string) => Promise<void>) | null): void {
  autoCommitFn = fn;
}

async function autoCommit(): Promise<void> {
  if (autoCommitFn) await autoCommitFn('[agents] updated');
}

function agentsPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/agents.md`);
}

const DEFAULT_AGENTS = `# 行为守则

## 优先级判断
- 涉及人身安全/系统宕机 → 高
- 客户投诉/SLA违约风险 → 高
- 常规业务变更 → 正常
- 信息同步类 → 低

## 整理规范
- 保持时间顺序
- 同类事项分组呈现
- 待办事项必须有明确action owner

## 禁忌
- 不在交接记录中记录人事评价
- 不添加原始记录中不存在的任何信息
`;

export async function getAgents(channelCode: string): Promise<string> {
  const p = agentsPath(channelCode);
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return DEFAULT_AGENTS;
  }
}

export async function saveAgents(channelCode: string, content: string): Promise<void> {
  const dir = path.dirname(agentsPath(channelCode));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(agentsPath(channelCode), content, 'utf-8');
  await autoCommit();
}

export function buildAgentsPrompt(agents: string): string {
  return agents;
}

export function getDefaultAgents(): string {
  return DEFAULT_AGENTS;
}