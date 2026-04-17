import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  handleHandoverStart,
  handleHandoverAccept,
  handleHandoverCancel,
  handleDraftView,
} from '../src/services/handover-orchestrator';
import { saveChannelsConfig } from '../src/services/config-service';
import { createDraft, appendToDraft } from '../src/services/draft-service';
import { savePendingHandover, findPendingHandover, removePendingHandover } from '../src/services/handover-service';
import type { UserInfo, ChannelAdapter, MessageContent, CardContent } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_orchestrator_test');

function createMockChannel(): { channel: ChannelAdapter; getMessages: () => MessageContent[]; getCards: () => CardContent[] } {
  const messages: MessageContent[] = [];
  const cards: CardContent[] = [];

  const channel: ChannelAdapter = {
    type: 'feishu',
    code: 'qiantai',
    name: '前台群',
    initialize: async () => {},
    receiveMessage: async () => null,
    parseCommand: () => null,
    getUserInfo: async (userId: string) => ({ id: userId, name: '测试用户' }),
    getChatMembers: async () => [],
    sendMessage: async (chatId: string, message: MessageContent) => { messages.push(message); },
    sendCard: async (chatId: string, card: CardContent) => { cards.push(card); },
  };

  return { channel, getMessages: () => messages, getCards: () => cards };
}

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
  await saveChannelsConfig({
    platforms: {},
    channels: [
      { code: 'qiantai', type: 'feishu', name: '前台群', chatId: 'oc_123', settings: { requireAccept: true, messageFilter: 'all' }, isEnabled: true },
    ],
  });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('handover-orchestrator', () => {
  const sender: UserInfo = { id: 'u1', name: '张三' };

  describe('handleDraftView', () => {
    it('sends message when no draft exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await handleDraftView(sender, channel, 'oc_123', 'qiantai');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('没有草稿');
    });

    it('sends card when draft exists', async () => {
      const { channel, getCards } = createMockChannel();
      await createDraft('qiantai');
      await appendToDraft('qiantai', {
        messageId: 'msg_1', type: 'text', sender, rawContent: '测试',
        analysis: null, status: 'pending_analysis', timestamp: new Date(),
      });

      await handleDraftView(sender, channel, 'oc_123', 'qiantai');
      expect(getCards()).toHaveLength(1);
    });
  });

  describe('handleHandoverStart', () => {
    it('rejects when no draft exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai', async () => 'content');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('没有草稿');
    });

    it('rejects when pending handover already exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await createDraft('qiantai');
      await savePendingHandover('qiantai', sender, 'existing');

      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai', async () => 'content');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('已有待交接');
    });

    it('sends require-accept card in Mode A', async () => {
      const { channel, getCards } = createMockChannel();
      await createDraft('qiantai');

      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai', async () => '交接内容');
      expect(getCards()).toHaveLength(1);
      expect(getCards()[0].title).toContain('交班');
    });
  });

  describe('handleHandoverCancel', () => {
    it('rejects when no pending handover', async () => {
      const { channel, getMessages } = createMockChannel();
      await handleHandoverCancel(sender, channel, 'oc_123', 'qiantai');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('没有待交接');
    });

    it('removes pending handover and sends confirmation', async () => {
      const { channel, getMessages } = createMockChannel();
      await savePendingHandover('qiantai', sender, 'content');
      await handleHandoverCancel(sender, channel, 'oc_123', 'qiantai');
      expect(await findPendingHandover('qiantai')).toBeNull();
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('已取消');
    });
  });
});