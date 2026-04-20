import type { CardAction } from '../types';
import fs from 'fs/promises';
import path from 'path';
import { readDraft, parseDraftSections, clearDraft, updateDraftAnalysis } from './draft-service';
import { findPendingHandover, removePendingHandover } from './handover-service';
import { handleHandoverStart } from './handover-orchestrator';
import { channelFactory } from '../channels/channel-factory';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { getLatestHandover } from './context-service';
import { getSystemPrompt, getTemplate } from './config-service';
import { getSoul, buildSoulPrompt } from './agent-soul-service';
import { getExperience, buildExperiencePrompt } from './experience-service';
import { getApp } from '../app';
import { logger } from '../utils/logger';
import { getDataDir } from '../utils/data-dir';
import { acquireLock, releaseLock } from '../utils/file-lock';

export async function handleCardAction(action: CardAction): Promise<Record<string, unknown> | null> {
  const channelCode = action.channelCode;
  if (!channelCode) {
    logger.warn('Card action missing channelCode');
    return null;
  }

  if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
    logger.warn(`Card action invalid channelCode: ${channelCode}`);
    return null;
  }

  let channel;
  try {
    channel = channelFactory.get(channelCode);
  } catch {
    logger.warn(`Card action channel not found: ${channelCode}`);
    return { toast: { type: 'warning', content: '渠道不存在' } };
  }

  switch (action.action) {
    case 'save': {
      if (action.formValue) {
        await updateDraftFromForm(action.formValue, channelCode);
      }
      return { toast: { type: 'success', content: '草稿已保存' } };
    }

    case 'regenerate': {
      const app = getApp();
      if (!app) {
        logger.warn('App not initialized, cannot regenerate');
        return null;
      }

      const provider = llmProviderFactory.hasDefault() ? llmProviderFactory.getDefault() : null;
      if (!provider) {
        return { toast: { type: 'warning', content: '未配置 LLM Provider，无法重新整理' } };
      }

      const draft = await readDraft(channelCode);
      if (!draft) {
        return { toast: { type: 'warning', content: '草稿为空，无法重新整理' } };
      }

      const template = await getTemplate(channelCode);
      const previousHandover = await getLatestHandover(channelCode);
      const systemPrompt = await getSystemPrompt(channelCode);
      const soul = await getSoul(channelCode);
      const soulPrompt = buildSoulPrompt(soul);
      const experience = await getExperience(channelCode);
      const experiencePrompt = buildExperiencePrompt(experience);
      app.llmQueue.enqueue(channelCode, {
        execute: () => provider.generateHandover({
          draft, template, previousHandover: previousHandover ?? undefined, systemPrompt, soulPrompt, experiencePrompt,
        }),
        onSuccess: (result: unknown) => {
          const content = typeof result === 'string' ? result : String(result);
          updateDraftPreview(channelCode, content);
          logger.info(`Draft regenerated for ${channelCode}`);
        },
        onFailure: (err: Error) => {
          logger.error(`Draft regeneration failed: ${err.message}`);
        },
      });

      return { toast: { type: 'success', content: '正在重新整理...' } };
    }

    case 'handover': {
      const operator = await channel.getUserInfo(action.operator.open_id);
      await handleHandoverStart(operator, channel, action.chatId, channelCode, async (draft, template, previousHandover, systemPrompt, soulPrompt, experiencePrompt) => {
        if (llmProviderFactory.hasDefault()) {
          return llmProviderFactory.getDefault().generateHandover({
            draft, template, previousHandover: previousHandover ?? undefined, systemPrompt, soulPrompt, experiencePrompt,
          });
        }
        return draft;
      });
      return { toast: { type: 'success', content: '交接已发起' } };
    }

    default:
      logger.warn(`Unknown card action: ${action.action}`);
      return null;
  }
}

async function updateDraftFromForm(formValue: Record<string, string>, channelCode: string): Promise<void> {
  const editedContent = formValue.markdown || formValue.content || '';

  const lockKey = `draft_${channelCode}`;
  await acquireLock(lockKey);

  try {
    const draft = await readDraft(channelCode);
    if (!draft) return;

    const { rawRecords } = parseDraftSections(draft);
    const draftPath = path.join(getDataDir(), `channels/${channelCode}/drafts/ongoing.md`);
    const newContent = `${rawRecords}\n\n## LLM 整理预览\n\n${editedContent}\n`;
    await fs.writeFile(draftPath, newContent, 'utf-8');
  } finally {
    releaseLock(lockKey);
  }
}

async function updateDraftPreview(channelCode: string, content: string): Promise<void> {
  const lockKey = `draft_${channelCode}`;
  await acquireLock(lockKey);

  try {
    const draft = await readDraft(channelCode);
    if (!draft) return;

    const { rawRecords } = parseDraftSections(draft);
    const draftPath = path.join(getDataDir(), `channels/${channelCode}/drafts/ongoing.md`);
    const newContent = `${rawRecords}\n\n## LLM 整理预览\n\n${content}\n`;
    await fs.writeFile(draftPath, newContent, 'utf-8');
  } finally {
    releaseLock(lockKey);
  }
}