import type { UserInfo, ChannelAdapter } from '../types';
import { readPreview, clearPreview } from './draft-preview-service';
import { clearRawRecords } from './draft-raw-service';
import { clearAnalysis, completenessCheck } from './draft-analysis-service';
import { findPendingHandover as findPending, savePendingHandover as savePending, removePendingHandover as removePending, buildHandoverRecord, saveHandoverRecord, formatDate } from './handover-service';
import { getChannelConfig } from './config-service';
import { addReaction } from './reaction-service';
import { buildHandoverCard } from '../channels/feishu-card-builder';
import { logger } from '../utils/logger';

export async function handleHandoverStart(
  sender: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string,
): Promise<void> {
  const channelConfig = await getChannelConfig(channelCode);

  const preview = await readPreview(channelCode);
  if (!preview || !preview.trim()) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有草稿内容，无法发起交接。' });
    return;
  }

  const rawPending = await findPending(channelCode);
  if (rawPending) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前已有待交接记录，请等待接班人确认或取消后再试。' });
    return;
  }

  await addReaction(channel, chatId, '🤔');

  // Check completeness before handover
  const check = await completenessCheck(channelCode);
  if (check.missing > 0) {
    logger.info(`交班完整性检查: ${check.missing} 条消息未分析 (共 ${check.totalRaw} 条)`);
  }

  // Snapshot: use preview.md content as handover body
  const handoverBody = preview;

  if (channelConfig?.settings.requireAccept) {
    // Mode A: need acceptance — save pending with snapshot
    await savePending(channelCode, sender, handoverBody);
    await addReaction(channel, chatId, '✅');
    await channel.sendCard(chatId, buildHandoverCard(sender.name, handoverBody, true));
  } else {
    // Mode B: save as pending, sender can self-confirm via H5
    await savePending(channelCode, sender, handoverBody);
    await addReaction(channel, chatId, '✅');
    await channel.sendCard(chatId, buildHandoverCard(sender.name, handoverBody, true));
  }
}

/** Accept handover via H5 confirmation */
export async function handleHandoverAccept(
  receiver: UserInfo,
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string,
): Promise<void> {
  const channelConfig = await getChannelConfig(channelCode);

  const rawPending = await findPending(channelCode);
  if (!rawPending) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有待交接的记录。' });
    return;
  }

  if (!channelConfig?.settings.requireAccept) {
    // Mode B: only the original sender can self-confirm
    const senderInfo = rawPending?.sender as { id: string; name: string } | undefined;
    if (senderInfo && receiver.id !== senderInfo.id) {
      await channel.sendMessage(chatId, { type: 'text', text: '当前群允许交班人自行确认，无需他人确认。' });
      return;
    }
  }

  const pending = rawPending;
  const sender = pending.sender as { id: string; name: string };
  const finalBody = pending.content as string;

  const filename = `${formatDate()}_${sender.id}_${receiver.id}.md`;
  const now = new Date().toISOString();
  const record = await buildHandoverRecord(channelCode, sender, receiver, finalBody, {
    requireAccept: true,
    createdAt: pending.createdAt as string,
    completedAt: now,
  });
  await saveHandoverRecord(channelCode, filename, record);
  await clearDraftData(channelCode);
  await removePending(channelCode);

  const { buildCompletionCard } = await import('../channels/feishu-card-builder');
  await channel.sendCard(chatId, buildCompletionCard(sender.name, receiver.name, finalBody));
}

/** Reject handover via H5 (打回) */
export async function handleHandoverReject(
  channel: ChannelAdapter,
  chatId: string,
  channelCode: string,
): Promise<void> {
  await removePending(channelCode);
  await channel.sendMessage(chatId, { type: 'text', text: '交班已被打回，交班人可重新编辑草稿后再发起交班。' });
}

/** Clear all draft data (raw + analysis + preview) after archival */
async function clearDraftData(channelCode: string): Promise<void> {
  await Promise.all([
    clearRawRecords(channelCode),
    clearAnalysis(channelCode),
    clearPreview(channelCode),
  ]);
}