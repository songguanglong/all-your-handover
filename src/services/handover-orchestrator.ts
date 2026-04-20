import type { UserInfo, ChannelAdapter } from '../types';
import { readDraft, clearDraft, parseDraftSections } from './draft-service';
import { findPendingHandover as findPending, savePendingHandover as savePending, removePendingHandover as removePending, buildHandoverRecord, saveHandoverRecord, formatDate } from './handover-service';
import { getChannelConfig, getTemplate, getSystemPrompt } from './config-service';
import { getLatestHandover } from './context-service';
import { getSoul, buildSoulPrompt } from './agent-soul-service';
import { getExperience, buildExperiencePrompt, analyzeEditIntent } from './experience-service';
import { addReaction } from './reaction-service';
import { buildDraftCard, buildHandoverCard, buildCompletionCard } from '../channels/feishu-card-builder';

interface PendingHandoverData {
  channelCode: string;
  sender: { id: string; name: string };
  content: string;
  createdAt: string;
}

function parsePendingHandover(raw: Record<string, unknown>): PendingHandoverData | null {
  const sender = raw.sender;
  if (!sender || typeof sender !== 'object') return null;
  const s = sender as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string') return null;
  if (typeof raw.content !== 'string') return null;
  if (typeof raw.createdAt !== 'string') return null;
  return {
    channelCode: typeof raw.channelCode === 'string' ? raw.channelCode : '',
    sender: { id: s.id, name: s.name },
    content: raw.content,
    createdAt: raw.createdAt,
  };
}

export async function handleHandoverStart(
  sender: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string,
  generateHandover: (draft: string, template: string, previousHandover?: { id: string; date: string; body: string } | null, systemPrompt?: string, soulPrompt?: string, experiencePrompt?: string) => Promise<string>
): Promise<void> {
  const channelConfig = await getChannelConfig(channelCode);

  const draft = await readDraft(channelCode);
  if (!draft) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有草稿内容，无法发起交接。' });
    return;
  }

  const rawPending = await findPending(channelCode);
  if (rawPending) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前已有待交接记录，请等待接班人确认或取消后再试。' });
    return;
  }

  await addReaction(channel, chatId, '🤔');

  const template = await getTemplate(channelCode);
  const previousHandover = await getLatestHandover(channelCode);
  const systemPrompt = await getSystemPrompt(channelCode);
  const soul = await getSoul(channelCode);
  const soulPrompt = buildSoulPrompt(soul);
  const experience = await getExperience(channelCode);
  const experiencePrompt = buildExperiencePrompt(experience);
  const handoverBody = await generateHandover(draft, template, previousHandover, systemPrompt, soulPrompt, experiencePrompt);

  if (channelConfig?.settings.requireAccept) {
    // Mode A: need acceptance
    await savePending(channelCode, sender, handoverBody, handoverBody);
    await addReaction(channel, chatId, '✅');
    await channel.sendCard(chatId, buildHandoverCard(sender.name, handoverBody, true));
  } else {
    // Mode B: auto-archive
    const filename = `${formatDate()}_${sender.id}_archived.md`;
    const now = new Date().toISOString();
    const record = await buildHandoverRecord(channelCode, sender, null, handoverBody, {
      requireAccept: false,
      createdAt: now,
    });
    await saveHandoverRecord(channelCode, filename, record);
    await clearDraft(channelCode);
    await addReaction(channel, chatId, '✅');
    await channel.sendCard(chatId, buildHandoverCard(sender.name, handoverBody, false));
  }
}

export async function handleHandoverAccept(
  receiver: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string,
  getChatCompletion?: () => ((messages: Array<{ role: string; content: string }>) => Promise<string>) | null
): Promise<void> {
  const channelConfig = await getChannelConfig(channelCode);

  if (!channelConfig?.settings.requireAccept) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前群不需要接班确认，交班时已自动归档。' });
    return;
  }

  const rawPending = await findPending(channelCode);
  if (!rawPending) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有待交接的记录。' });
    return;
  }

  const pending = parsePendingHandover(rawPending);
  if (!pending) {
    await channel.sendMessage(chatId, { type: 'text', text: '待交接记录格式异常，请取消后重新交班。' });
    return;
  }

  const finalBody = pending.content;
  const llmVersion = (rawPending as Record<string, unknown>).llmVersion as string | undefined;

  const filename = `${formatDate()}_${pending.sender.id}_${receiver.id}.md`;
  const now = new Date().toISOString();
  const record = await buildHandoverRecord(channelCode, pending.sender, receiver, finalBody, {
    requireAccept: true,
    createdAt: pending.createdAt,
    completedAt: now,
  });
  await saveHandoverRecord(channelCode, filename, record);

  // Edit intent analysis: compare LLM version vs final (user-edited) version
  if (llmVersion && llmVersion !== finalBody && getChatCompletion) {
    const chatCompletion = getChatCompletion();
    if (chatCompletion) {
      try {
        const entry = await analyzeEditIntent(channelCode, llmVersion, finalBody, chatCompletion);
        if (entry) {
          const { addEntry } = await import('./experience-service');
          await addEntry(channelCode, entry);
        }
      } catch (err) {
        // Edit intent analysis is non-critical
        const { logger } = await import('../utils/logger');
        logger.warn(`编辑意图分析失败: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  await clearDraft(channelCode);
  await removePending(channelCode);

  await channel.sendCard(chatId, buildCompletionCard(pending.sender.name, receiver.name, finalBody));
}

export async function handleHandoverCancel(
  sender: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string
): Promise<void> {
  const rawPending = await findPending(channelCode);
  if (!rawPending) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有待交接的记录。' });
    return;
  }

  await removePending(channelCode);

  await channel.sendMessage(chatId, {
    type: 'text',
    text: `交接已取消（由 ${sender.name} 操作）。草稿内容保留，可重新 @自己 交班。`,
  });
}

export async function handleDraftView(
  sender: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string
): Promise<void> {
  const channelConfig = await getChannelConfig(channelCode);
  const channelDisplayName = channelConfig?.name ?? channelCode;

  const draft = await readDraft(channelCode);
  if (!draft) {
    await channel.sendMessage(chatId, {
      type: 'text',
      text: `${channelDisplayName} 当前没有草稿，发送第一条消息后将自动创建。`,
    });
    return;
  }

  const { rawRecords, llmPreview } = parseDraftSections(draft);
  await channel.sendCard(chatId, buildDraftCard(channelCode, channelDisplayName, rawRecords, llmPreview, chatId));
}