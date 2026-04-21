import fs from 'fs/promises';
import path from 'path';
import type { Message, ChannelAdapter, AnalyzeResult, LLMTask, LLMProvider, RawRecord, AnalysisItem } from '../types';
import { appendRawRecord } from './draft-raw-service';
import { updateAnalysis, markItemRecalled } from './draft-analysis-service';
import { incrementalUpdatePreview, removeItemFromPreview } from './draft-preview-service';
import { validateAnalysis } from './analysis-validator';
import { getSoul, buildSoulPrompt } from './soul-service';
import { getAgents, buildAgentsPrompt } from './agents-service';
import { getChannelMemory, extractMemoryForPrompt } from './channel-memory-service';
import { getExperience, buildExperiencePrompt } from './experience-service';
import { addReaction } from './reaction-service';
import { logger } from '../utils/logger';
import { getDataDir } from '../utils/data-dir';

// Pluggable notifier for draft updates (wired in app.ts to SSE event bus)
let draftUpdateNotifier: ((channelCode: string) => void) | null = null;

export function setDraftUpdateNotifier(fn: ((channelCode: string) => void) | null): void {
  draftUpdateNotifier = fn;
}

function notifyDraftUpdate(channelCode: string): void {
  if (draftUpdateNotifier) draftUpdateNotifier(channelCode);
}

const VALID_CATEGORIES_PROMPT = '重要事项, 一般事项, 待办事项, 待跟进事项, 客房, 设备, 安全, 客户, 未分类';
const TEXT_ANALYSIS_PROMPT = `分析以下交接班消息，提取关键信息。返回JSON: {"category":"类别","content":"摘要","urgency":"high/normal/low"}\ncategory 必须是以下之一: ${VALID_CATEGORIES_PROMPT}`;
const IMAGE_ANALYSIS_PROMPT = `描述这张交接班相关图片的内容。返回JSON: {"category":"类别","content":"描述","urgency":"high/normal/low"}\ncategory 必须是以下之一: ${VALID_CATEGORIES_PROMPT}`;
const AUDIO_ANALYSIS_PROMPT = `分析以下交接班语音内容，提取关键信息。返回JSON: {"category":"类别","content":"摘要","urgency":"high/normal/low"}\ncategory 必须是以下之一: ${VALID_CATEGORIES_PROMPT}`;
const AUDIO_TRANSCRIPTION_PROMPT = '转写这段交接班语音内容。';

function noProviderFallback(text: string): () => Promise<AnalyzeResult> {
  return () => Promise.resolve({ category: '未分类', content: text, urgency: 'normal' });
}

function toAnalysisItem(msgId: string, result: AnalyzeResult): AnalysisItem {
  return { msgId, ...result };
}

async function buildContextPrompt(channelCode: string): Promise<string> {
  const [soul, agents, memory, experience] = await Promise.all([
    getSoul(channelCode),
    getAgents(channelCode),
    getChannelMemory(channelCode),
    getExperience(channelCode),
  ]);

  const parts: string[] = [buildSoulPrompt(soul, buildAgentsPrompt(agents))];

  const memoryPrompt = extractMemoryForPrompt(memory);
  if (memoryPrompt) parts.push(memoryPrompt);

  const experiencePrompt = buildExperiencePrompt(experience);
  if (experiencePrompt) parts.push(experiencePrompt);

  return parts.join('\n\n');
}

function buildPromptWithQuote(basePrompt: string, quotedContext?: string): string {
  if (!quotedContext) return basePrompt;
  return `${basePrompt}\n\n以下是该消息引用的上一条消息内容，请结合引用内容理解当前消息的上下文:\n${quotedContext}`;
}

function handleAnalysisResult(channelCode: string, messageId: string, rawResult: unknown, originalText: string): Promise<void> {
  const validated = validateAnalysis(rawResult, originalText);
  const item = toAnalysisItem(messageId, validated);
  return Promise.all([
    updateAnalysis(channelCode, item),
    incrementalUpdatePreview(channelCode, item),
  ]).then(() => { notifyDraftUpdate(channelCode); });
}

export async function handleTextMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null,
  quotedContext?: string
): Promise<void> {
  const text = (message.content as { text: string }).text;

  await addReaction(channel, message.id, '🤔');

  const record: RawRecord = {
    id: message.id,
    ts: new Date(message.timestamp).toISOString(),
    sender: message.sender.id,
    sender_name: message.sender.name,
    type: 'text',
    content: text,
    quoted_context: quotedContext ?? null,
  };
  await appendRawRecord(channelCode, record);

  const prompt = buildPromptWithQuote(TEXT_ANALYSIS_PROMPT, quotedContext);
  const soulPrompt = await buildContextPrompt(channelCode);
  const provider = getProvider();
  enqueueLLM(channelCode, {
    execute: provider
      ? () => provider.analyzeText({ text, prompt, soulPrompt })
      : noProviderFallback(text),
    onSuccess: (analysis: unknown) => {
      handleAnalysisResult(channelCode, message.id, analysis, text)
        .then(() => addReaction(channel, message.id, '✅'))
        .catch(err => logger.error(`写入分析结果失败: ${err instanceof Error ? err.message : err}`));
    },
    onFailure: (err: Error) => logger.error(`LLM 分析失败: ${err.message}`),
  });
}

export async function handleImageMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null,
  quotedContext?: string
): Promise<void> {
  const imageDir = path.join(getDataDir(), `channels/${channelCode}/media/images`);
  await fs.mkdir(imageDir, { recursive: true });
  const imagePath = path.join(imageDir, `${message.id}.jpg`);

  if (message.content.type === 'image' && message.content.data.length > 0) {
    await fs.writeFile(imagePath, message.content.data);
  } else if (message.content.type === 'image') {
    logger.warn(`图片数据为空，跳过保存: ${imagePath}`);
  }

  await addReaction(channel, message.id, '🤔');

  const record: RawRecord = {
    id: message.id,
    ts: new Date(message.timestamp).toISOString(),
    sender: message.sender.id,
    sender_name: message.sender.name,
    type: 'image',
    content: `[图片: ${imagePath}]`,
    quoted_context: quotedContext ?? null,
  };
  await appendRawRecord(channelCode, record);

  const prompt = buildPromptWithQuote(IMAGE_ANALYSIS_PROMPT, quotedContext);
  const soulPrompt = await buildContextPrompt(channelCode);
  const provider = getProvider();
  enqueueLLM(channelCode, {
    execute: provider
      ? () => provider.analyzeImage({ imagePath, prompt, soulPrompt })
      : noProviderFallback(`[图片: ${imagePath}]`),
    onSuccess: (analysis: unknown) => {
      handleAnalysisResult(channelCode, message.id, analysis, `[图片: ${imagePath}]`)
        .then(() => addReaction(channel, message.id, '✅'))
        .catch(err => logger.error(`写入分析结果失败: ${err instanceof Error ? err.message : err}`));
    },
    onFailure: (err: Error) => logger.error(`LLM 图片分析失败: ${err.message}`),
  });
}

export async function handleAudioMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null,
  quotedContext?: string
): Promise<void> {
  const audioDir = path.join(getDataDir(), `channels/${channelCode}/media/audio`);
  await fs.mkdir(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, `${message.id}.opus`);

  if (message.content.type === 'audio' && message.content.data.length > 0) {
    await fs.writeFile(audioPath, message.content.data);
  } else if (message.content.type === 'audio') {
    logger.warn(`语音数据为空，跳过保存: ${audioPath}`);
  }

  await addReaction(channel, message.id, '🤔');

  const record: RawRecord = {
    id: message.id,
    ts: new Date(message.timestamp).toISOString(),
    sender: message.sender.id,
    sender_name: message.sender.name,
    type: 'audio',
    content: '[语音消息]',
    quoted_context: quotedContext ?? null,
  };
  await appendRawRecord(channelCode, record);

  const soulPrompt = await buildContextPrompt(channelCode);
  const provider = getProvider();
  if (!provider) {
    enqueueLLM(channelCode, {
      execute: noProviderFallback('[语音消息]'),
      onSuccess: (analysis: unknown) => {
        handleAnalysisResult(channelCode, message.id, analysis, '[语音消息]')
          .then(() => addReaction(channel, message.id, '✅'))
          .catch(err => logger.error(`写入分析结果失败: ${err instanceof Error ? err.message : err}`));
      },
      onFailure: (err: Error) => logger.error(`LLM 分析失败: ${err.message}`),
    });
    return;
  }

  const prompt = buildPromptWithQuote(AUDIO_ANALYSIS_PROMPT, quotedContext);
  enqueueLLM(channelCode, {
    execute: async () => {
      try {
        return await provider.transcribeAudio({ audioPath, prompt, soulPrompt });
      } catch (err) {
        logger.warn(`LLM 多模态语音分析失败，回退到 Whisper+文本分析: ${err instanceof Error ? err.message : err}`);
        const transcription = await provider.transcribeAudio({ audioPath, prompt: AUDIO_TRANSCRIPTION_PROMPT, soulPrompt });
        const textPrompt = buildPromptWithQuote(TEXT_ANALYSIS_PROMPT, quotedContext);
        return await provider.analyzeText({ text: transcription, prompt: textPrompt, soulPrompt });
      }
    },
    onSuccess: (analysis: unknown) => {
      handleAnalysisResult(channelCode, message.id, analysis, '[语音消息]')
        .then(() => addReaction(channel, message.id, '✅'))
        .catch(err => logger.error(`写入分析结果失败: ${err instanceof Error ? err.message : err}`));
    },
    onFailure: (err: Error) => logger.error(`LLM 语音分析失败: ${err.message}`),
  });
}

/** Handle message retraction: append tombstone, mark analysis, remove from preview */
export async function handleMessageRecalled(channelCode: string, messageId: string): Promise<void> {
  // Append tombstone record to raw.jsonl
  const tombstone: RawRecord = {
    id: `recalled_${messageId}`,
    ts: new Date().toISOString(),
    sender: '',
    sender_name: '',
    type: 'recalled',
    content: '(消息已撤回)',
    quoted_context: null,
    recalled_msg_id: messageId,
  };
  await appendRawRecord(channelCode, tombstone);

  // Mark analysis item as recalled
  await markItemRecalled(channelCode, messageId);

  // Remove from preview.md
  await removeItemFromPreview(channelCode, messageId);

  notifyDraftUpdate(channelCode);

  logger.info(`消息已撤回: ${messageId} (渠道: ${channelCode})`);
}