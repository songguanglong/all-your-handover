import { describe, it, expect, vi } from 'vitest';
import { addReaction } from '../src/services/reaction-service';
import type { ChannelAdapter } from '../src/types';

function createMockAdapter(addReactionImpl?: (messageId: string, emoji: string) => Promise<void>): ChannelAdapter {
  return {
    type: 'test',
    code: 'test',
    name: 'test',
    addReaction: addReactionImpl,
    initialize: async () => {},
    receiveMessage: async () => null,
    sendMessage: async () => {},
    sendCard: async () => 'msg_123',
    parseCommand: () => null,
    getUserInfo: async () => ({ id: '', name: '' }),
    getChatMembers: async () => [],
    fetchMessageContent: async () => null,
  } as unknown as ChannelAdapter;
}

describe('Reaction Service', () => {
  it('calls channel.addReaction with correct emoji', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const channel = createMockAdapter(mockFn);

    await addReaction(channel, 'msg_1', '👀');
    expect(mockFn).toHaveBeenCalledWith('msg_1', '👀');

    await addReaction(channel, 'msg_2', '🤔');
    expect(mockFn).toHaveBeenCalledWith('msg_2', '🤔');

    await addReaction(channel, 'msg_3', '✅');
    expect(mockFn).toHaveBeenCalledWith('msg_3', '✅');
  });

  it('silently skips when channel has no addReaction', async () => {
    const channel = createMockAdapter(undefined);
    // Should not throw
    await expect(addReaction(channel, 'msg_1', '👀')).resolves.toBeUndefined();
  });

  it('silently skips on addReaction error', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('API error'));
    const channel = createMockAdapter(mockFn);
    // Should not throw
    await expect(addReaction(channel, 'msg_1', '👀')).resolves.toBeUndefined();
  });
});