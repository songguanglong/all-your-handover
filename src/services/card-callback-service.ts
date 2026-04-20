import type { CardAction } from '../types';
import { handleHandoverStart } from './handover-orchestrator';
import { channelFactory } from '../channels/channel-factory';
import { logger } from '../utils/logger';

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
    case 'handover': {
      const operator = await channel.getUserInfo(action.operator.open_id);
      await handleHandoverStart(operator, channel, action.chatId, channelCode);
      return { toast: { type: 'success', content: '交接已发起' } };
    }

    default:
      logger.warn(`Unknown card action: ${action.action}`);
      return null;
  }
}