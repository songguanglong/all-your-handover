import type { ChannelAdapter } from '../types';

export type ReactionEmoji = '👀' | '🤔' | '✅';

export async function addReaction(
  channel: ChannelAdapter,
  messageId: string,
  emoji: ReactionEmoji
): Promise<void> {
  if (!channel.addReaction) return;
  try {
    await channel.addReaction(messageId, emoji);
  } catch {
    // Reaction failures are non-critical, silently skip
  }
}