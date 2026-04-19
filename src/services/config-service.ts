import fs from 'fs/promises';
import path from 'path';
import type { ChannelsConfig, ChannelConfig, LLMProvidersConfig, LLMProviderConfig } from '../types';
import { getDataDir } from '../utils/data-dir';

function channelsConfigPath(): string {
  return path.join(getDataDir(), 'config/channels.json');
}

function llmProvidersConfigPath(): string {
  return path.join(getDataDir(), 'config/llm-providers.json');
}

const DEFAULT_TEMPLATE = `# 交接单

## 重要事项
{{important}}

## 一般事项
{{normal}}

## 待跟进事项
{{follow_up}}
`;

const DEFAULT_SYSTEM_PROMPT = '你是一个交接班助手。请根据以下模版和草稿内容，生成交接班记录。保持模版结构，用实际内容替换占位符。';

// --- Channels Config ---

export async function loadChannelsConfig(): Promise<ChannelsConfig> {
  try {
    const data = await fs.readFile(channelsConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { platforms: {}, channels: [] };
  }
}

export async function saveChannelsConfig(config: ChannelsConfig): Promise<void> {
  const p = channelsConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(config, null, 2));
}

export async function findChannelCodeByChatId(chatId: string): Promise<string | null> {
  const config = await loadChannelsConfig();
  const channel = config.channels.find(ch => ch.chatId === chatId && ch.isEnabled);
  return channel?.code ?? null;
}

export async function getChannelConfig(channelCode: string): Promise<ChannelConfig | null> {
  const config = await loadChannelsConfig();
  return config.channels.find(ch => ch.code === channelCode) ?? null;
}

// --- LLM Providers Config ---

export async function loadLLMProvidersConfig(): Promise<LLMProvidersConfig> {
  try {
    const data = await fs.readFile(llmProvidersConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { providers: [], defaultProviderId: null };
  }
}

export async function saveLLMProvidersConfig(config: LLMProvidersConfig): Promise<void> {
  const p = llmProvidersConfigPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(config, null, 2));
}

export async function getDefaultProviderConfig(): Promise<LLMProviderConfig | null> {
  const config = await loadLLMProvidersConfig();
  if (!config.defaultProviderId) return null;
  return config.providers.find(p => p.id === config.defaultProviderId && p.isEnabled) ?? null;
}

// --- Template ---

export async function getTemplate(channelCode: string): Promise<string> {
  const templatePath = path.join(getDataDir(), `channels/${channelCode}/template.md`);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export async function saveTemplate(channelCode: string, content: string): Promise<void> {
  const templatePath = path.join(getDataDir(), `channels/${channelCode}/template.md`);
  await fs.mkdir(path.dirname(templatePath), { recursive: true });
  await fs.writeFile(templatePath, content);
}

export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE;
}

// --- System Prompt ---

function systemPromptPath(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/system-prompt.txt`);
}

export async function getSystemPrompt(channelCode: string): Promise<string> {
  try {
    return await fs.readFile(systemPromptPath(channelCode), 'utf-8');
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

export async function saveSystemPrompt(channelCode: string, content: string): Promise<void> {
  const p = systemPromptPath(channelCode);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content);
}

export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}