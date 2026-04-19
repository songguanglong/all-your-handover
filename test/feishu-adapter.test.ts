import { describe, it, expect } from 'vitest';
import type { Message } from '../src/types';
import { FeishuAdapter } from '../src/channels/feishu-adapter';

describe('FeishuAdapter', () => {
  const adapter = new FeishuAdapter('test', '测试群');

  describe('parseCommand', () => {
    const baseMessage: Message = {
      id: 'msg_1',
      chatId: 'oc_test',
      senderId: 'user_1',
      senderName: '张三',
      sender: { id: 'user_1', name: '张三' },
      content: { type: 'text', text: '' },
      type: 'text',
      timestamp: Date.now(),
      mentionsBot: true,
      mentionsSelf: true,
      mentionList: ['user_1'], // user @'d themselves
    };

    it('parses 交班 command', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '交班' } };
      const cmd = adapter.parseCommand(msg);
      expect(cmd?.type).toBe('HANDOVER_START');
    });

    it('parses 接班 command', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '接班' } };
      const cmd = adapter.parseCommand(msg);
      expect(cmd?.type).toBe('HANDOVER_ACCEPT');
    });

    it('parses 取消 command', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '取消' } };
      const cmd = adapter.parseCommand(msg);
      expect(cmd?.type).toBe('HANDOVER_CANCEL');
    });

    it('parses 草稿 command', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '草稿' } };
      const cmd = adapter.parseCommand(msg);
      expect(cmd?.type).toBe('DRAFT_VIEW');
    });

    it('returns null for non-command text', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '今天天气不错' } };
      expect(adapter.parseCommand(msg)).toBeNull();
    });

    it('returns null when user did not @ themselves', () => {
      const msg = { ...baseMessage, content: { type: 'text' as const, text: '交班' }, mentionsSelf: false, mentionsBot: false, mentionList: [] };
      expect(adapter.parseCommand(msg)).toBeNull();
    });

    it('returns null for non-text messages', () => {
      const msg = { ...baseMessage, type: 'image', content: { type: 'image' as const, data: Buffer.alloc(0) } };
      expect(adapter.parseCommand(msg)).toBeNull();
    });
  });

  describe('receiveMessage', () => {
    it('parses text message event', async () => {
      const event = {
        event: {
          message: {
            message_id: 'msg_1',
            chat_id: 'oc_test',
            msg_type: 'text',
            content: JSON.stringify({ text: 'Hello' }),
            mentions: [],
          },
          sender: {
            sender_id: { open_id: 'user_1' },
          },
        },
      };

      const msg = await adapter.receiveMessage(event);
      expect(msg).not.toBeNull();
      expect(msg?.type).toBe('text');
      expect(msg?.senderId).toBe('user_1');
    });

    it('returns null for event without message', async () => {
      const msg = await adapter.receiveMessage({});
      expect(msg).toBeNull();
    });
  });

  describe('fetchMessageContent', () => {
    it('returns message content string', async () => {
      const client = adapter.getClient();
      const origGetMessage = client.getMessage.bind(client);
      client.getMessage = async () => ({ body: { content: '{"text":"引用的消息"}' } });
      const content = await adapter.fetchMessageContent('msg_parent');
      expect(content).toBe('{"text":"引用的消息"}');
      client.getMessage = origGetMessage;
    });

    it('returns null when message not found', async () => {
      const client = adapter.getClient();
      const origGetMessage = client.getMessage.bind(client);
      client.getMessage = async () => ({ body: null });
      const content = await adapter.fetchMessageContent('msg_missing');
      expect(content).toBeNull();
      client.getMessage = origGetMessage;
    });

    it('returns null on error', async () => {
      const client = adapter.getClient();
      const origGetMessage = client.getMessage.bind(client);
      client.getMessage = async () => { throw new Error('API error'); };
      const content = await adapter.fetchMessageContent('msg_error');
      expect(content).toBeNull();
      client.getMessage = origGetMessage;
    });
  });
});