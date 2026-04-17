import fs from 'fs/promises';
import path from 'path';
import type { Message, ChannelAdapter, AnalyzeResult, LLMTask, LLMProvider } from '../types';
import { appendToDraft, updateDraftAnalysis } from './draft-service';
import { getChannelConfig } from './config-service';
import { logger } from '../utils/logger';
import { getDataDir } from '../utils/data-dir';

const TEXT_ANALYSIS_PROMPT = '分析以下酒店交接班消息，提取关键信息。返回JSON: {"category":"类别","content":"摘要","urgency":"high/normal/low"}';
const IMAGE_ANALYSIS_PROMPT = '描述这张酒店交接班相关图片的内容。返回JSON: {"category":"类别","content":"描述","urgency":"high/normal/low"}';
const AUDIO_TRANSCRIPTION_PROMPT = '转写这段酒店交接班语音内容。';

function noProviderFallback(text: string): () => Promise<unknown> {
  return () => Promise.resolve({ category: '未分类', content: text, urgency: 'normal' });
}

function toAnalyzeResult(raw: unknown): AnalyzeResult {
  if (typeof raw === 'object' && raw !== null && 'category' in raw && 'content' in raw) {
    return raw as AnalyzeResult;
  }
  return { category: '未分类', content: String(raw), urgency: 'normal' };
}

export async function handleTextMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null
): Promise<void> {
  const text = (message.content as { text: string }).text;

  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'text',
    sender: message.sender,
    rawContent: text,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date(),
  });

  const provider = getProvider();
  enqueueLLM(channelCode, {
    execute: provider
      ? () => provider.analyzeText({ text, prompt: TEXT_ANALYSIS_PROMPT })
      : noProviderFallback(text),
    onSuccess: (analysis: unknown) => updateDraftAnalysis(channelCode, message.id, toAnalyzeResult(analysis)),
    onFailure: (err: Error) => logger.error(`LLM 分析失败: ${err.message}`),
  });
}

export async function handleImageMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null
): Promise<void> {
  const imageDir = path.join(getDataDir(), `channels/${channelCode}/media/images`);
  await fs.mkdir(imageDir, { recursive: true });
  const imagePath = path.join(imageDir, `${message.id}.jpg`);

  if (message.content.type === 'image' && message.content.data.length > 0) {
    await fs.writeFile(imagePath, message.content.data);
  }

  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'image',
    sender: message.sender,
    rawContent: `[图片: ${imagePath}]`,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date(),
  });

  const provider = getProvider();
  enqueueLLM(channelCode, {
    execute: provider
      ? () => provider.analyzeImage({ imagePath, prompt: IMAGE_ANALYSIS_PROMPT })
      : noProviderFallback(`[图片: ${imagePath}]`),
    onSuccess: (analysis: unknown) => updateDraftAnalysis(channelCode, message.id, toAnalyzeResult(analysis)),
    onFailure: (err: Error) => logger.error(`LLM 图片分析失败: ${err.message}`),
  });
}

export async function handleAudioMessage(
  message: Message,
  channel: ChannelAdapter,
  channelCode: string,
  enqueueLLM: (channelCode: string, task: import('../types').LLMTask) => void,
  getProvider: () => LLMProvider | null
): Promise<void> {
  const audioDir = path.join(getDataDir(), `channels/${channelCode}/media/audio`);
  await fs.mkdir(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, `${message.id}.opus`);

  if (message.content.type === 'audio' && message.content.data.length > 0) {
    await fs.writeFile(audioPath, message.content.data);
  }

  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'audio',
    sender: message.sender,
    rawContent: `[语音: ${audioPath}]`,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date(),
  });

  const provider = getProvider();
  enqueueLLM(channelCode, {
    execute: provider
      ? () => provider.transcribeAudio({ audioPath, prompt: AUDIO_TRANSCRIPTION_PROMPT })
      : noProviderFallback(`[语音: ${audioPath}]`),
    onSuccess: (transcription: unknown) => updateDraftAnalysis(channelCode, message.id, {
      category: '语音记录',
      content: typeof transcription === 'string' ? transcription : String(transcription),
      urgency: 'normal',
    }),
    onFailure: (err: Error) => logger.error(`LLM 语音转写失败: ${err.message}`),
  });
}