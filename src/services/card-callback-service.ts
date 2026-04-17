import type { CardAction } from '../types';
import fs from 'fs/promises';
import path from 'path';
import { readDraft, parseDraftSections, clearDraft } from './draft-service';
import { findPendingHandover, removePendingHandover } from './handover-service';
import { handleHandoverStart } from './handover-orchestrator';
import { channelFactory } from '../channels/channel-factory';
import { llmProviderFactory } from '../llm/llm-provider-factory';
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

      const { rawRecords } = parseDraftSections(draft);
      app.llmQueue.enqueue(channelCode, {
        execute: () => provider.analyzeText({
          text: rawRecords,
          prompt: '根据以下原始记录重新整理交接内容。返回JSON: {"category":"类别","content":"整理后的内容","urgency":"high/normal/low"}',
        }),
        onSuccess: () => {
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
      await handleHandoverStart(operator, channel, action.chatId, channelCode, async (draft, template) => {
        if (llmProviderFactory.hasDefault()) {
          return llmProviderFactory.getDefault().generateHandover({ draft, template });
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
  // Parse form values and update the draft's LLM preview section
  // The form contains edited markdown content from the card
  const draft = await readDraft(channelCode);
  if (!draft) return;

  const { rawRecords } = parseDraftSections(draft);
  const editedContent = formValue.markdown || formValue.content || '';

  // Rebuild draft with original records but updated preview
  const lockKey = `draft_${channelCode}`;
  await acquireLock(lockKey);

  try {
    const draftPath = path.join(getDataDir(), `channels/${channelCode}/drafts/ongoing.md`);
    const newContent = `${rawRecords}\n\n## LLM 整理预览\n\n${editedContent}\n`;
    await fs.writeFile(draftPath, newContent, 'utf-8');
  } finally {
    releaseLock(lockKey);
  }
}