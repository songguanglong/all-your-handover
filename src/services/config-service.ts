import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { ChannelsConfig, ChannelConfig, LLMProvidersConfig, LLMProviderConfig } from '../types';
import { getDataDir } from '../utils/data-dir';
import { logger } from '../utils/logger';

async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(dir, `.tmp_${crypto.randomBytes(8).toString('hex')}`);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(tmpFile, data);
    await fs.rename(tmpFile, filePath);
  } catch (err) {
    try { await fs.unlink(tmpFile); } catch {}
    throw err;
  }
}

const CHANNEL_CODE_RE = /^[a-zA-Z0-9_]{1,50}$/;

function validateChannelCode(channelCode: string): void {
  if (!CHANNEL_CODE_RE.test(channelCode)) {
    throw new Error(`Invalid channelCode: ${channelCode}`);
  }
}

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

## 待办事项
{{todo}}

## 待跟进事项
{{follow_up}}

## 客房
{{room}}

## 设备
{{equipment}}

## 安全
{{safety}}

## 客户
{{customer}}

## 未分类
{{other}}
`;

const DEFAULT_SYSTEM_PROMPT = '你是一个交接班助手，负责分析群聊消息并提取关键信息。请准确分类、提炼要点、判断优先级。保持客观，只记录事实，不添加推测。';

// --- Channels Config ---

export async function loadChannelsConfig(): Promise<ChannelsConfig> {
  try {
    const data = await fs.readFile(channelsConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`加载渠道配置失败: ${err instanceof Error ? err.message : err}`);
    }
    return { platforms: {}, channels: [] };
  }
}

export async function saveChannelsConfig(config: ChannelsConfig): Promise<void> {
  await atomicWriteFile(channelsConfigPath(), JSON.stringify(config, null, 2));
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
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`加载LLM配置失败: ${err instanceof Error ? err.message : err}`);
    }
    return { providers: [], defaultProviderId: null };
  }
}

export async function saveLLMProvidersConfig(config: LLMProvidersConfig): Promise<void> {
  await atomicWriteFile(llmProvidersConfigPath(), JSON.stringify(config, null, 2));
}

export async function getDefaultProviderConfig(): Promise<LLMProviderConfig | null> {
  const config = await loadLLMProvidersConfig();
  if (!config.defaultProviderId) return null;
  return config.providers.find(p => p.id === config.defaultProviderId && p.isEnabled) ?? null;
}

// --- Template ---

export async function getTemplate(channelCode: string): Promise<string> {
  validateChannelCode(channelCode);
  const templatePath = path.join(getDataDir(), `channels/${channelCode}/template.md`);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export async function saveTemplate(channelCode: string, content: string): Promise<void> {
  validateChannelCode(channelCode);
  const templatePath = path.join(getDataDir(), `channels/${channelCode}/template.md`);
  await atomicWriteFile(templatePath, content);
}

export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE;
}

// --- System Prompt ---

function systemPromptPath(channelCode: string): string {
  validateChannelCode(channelCode);
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
  await atomicWriteFile(systemPromptPath(channelCode), content);
}

export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}