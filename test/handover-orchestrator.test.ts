import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { handleHandoverStart, handleHandoverAccept, handleHandoverReject } from '../src/services/handover-orchestrator';
import { saveChannelsConfig } from '../src/services/config-service';
import { updatePreview } from '../src/services/draft-preview-service';
import { appendRawRecord } from '../src/services/draft-raw-service';
import { updateAnalysis } from '../src/services/draft-analysis-service';
import { savePendingHandover, findPendingHandover, removePendingHandover } from '../src/services/handover-service';
import type { UserInfo, ChannelAdapter, MessageContent, CardContent } from '../src/types';

const TMP_DIR = path.join(__dirname, '__tmp_orchestrator_test2');

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
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
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
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('handover-orchestrator', () => {
  const sender: UserInfo = { id: 'u1', name: '张三' };
  const receiver: UserInfo = { id: 'u2', name: '李四' };

  describe('handleHandoverStart', () => {
    it('rejects when no preview content exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('没有草稿');
    });

    it('rejects when pending handover already exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await updatePreview('qiantai', '# 交接班记录\n\n## 待办事项\n\n- 测试 (一般)');
      await savePendingHandover('qiantai', sender, 'existing');

      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('已有待交接');
    });

    it('sends require-accept card in Mode A', async () => {
      const { channel, getCards } = createMockChannel();
      await updatePreview('qiantai', '# 交接班记录\n\n## 待办事项\n\n- 测试内容 (一般)');

      await handleHandoverStart(sender, channel, 'oc_123', 'qiantai');
      expect(getCards()).toHaveLength(1);
      expect(getCards()[0].title).toContain('交班');
    });
  });

  describe('handleHandoverAccept', () => {
    it('rejects when no pending handover exists', async () => {
      const { channel, getMessages } = createMockChannel();
      await handleHandoverAccept(receiver, channel, 'oc_123', 'qiantai');
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('没有待交接');
    });
  });

  describe('handleHandoverReject', () => {
    it('removes pending handover and sends message', async () => {
      const { channel, getMessages } = createMockChannel();
      await savePendingHandover('qiantai', sender, 'content');
      await handleHandoverReject(channel, 'oc_123', 'qiantai');
      expect(await findPendingHandover('qiantai')).toBeNull();
      expect(getMessages()).toHaveLength(1);
      expect(getMessages()[0].text).toContain('打回');
    });
  });
});