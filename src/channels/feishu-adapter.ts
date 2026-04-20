import type {
  ChannelAdapter,
  PlatformConfig,
  Message,
  Command,
  UserInfo,
  MessageContent,
  CardContent,
  FeishuPlatformConfig,
} from '../types';
import { FeishuClient } from './feishu-client';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

interface FeishuEvent {
  event?: {
    message?: {
      chat_id?: string;
      message_id?: string;
      parent_id?: string;
      root_id?: string;
      msg_type?: string;
      content?: string;
      mentions?: Array<{
        id: { open_id?: string; user_id?: string };
        key?: string;
      }>;
    };
    sender?: {
      sender_id?: { open_id?: string; user_id?: string; name?: string };
    };
  };
}

export class FeishuAdapter implements ChannelAdapter {
  readonly type = 'feishu';
  readonly code: string;
  readonly name: string;
  private client: FeishuClient;
  private chatId: string = '';
  private botOpenId: string = '';
  private userInfoCache: Map<string, UserInfo> = new Map();

  constructor(code: string, name: string) {
    this.code = code;
    this.name = name;
    this.client = new FeishuClient();
  }

  async initialize(config: { platform: PlatformConfig; chatId: string }): Promise<void> {
    this.chatId = config.chatId;
    await this.client.initialize(config.platform as FeishuPlatformConfig);
    try {
      const botInfo = await this.client.getBotInfo();
      this.botOpenId = botInfo.openId || '';
    } catch (err) {
      logger.warn(`Failed to get bot info for ${this.code}: ${err}`);
    }
  }

  async receiveMessage(event: unknown): Promise<Message | null> {
    const ev = event as FeishuEvent;
    const msg = ev?.event?.message;
    const sender = ev?.event?.sender;

    if (!msg || !sender) return null;

    const senderId = sender.sender_id?.open_id || sender.sender_id?.user_id || '';
    const senderName = sender.sender_id?.name || '';

    const userInfo: UserInfo = { id: senderId, name: senderName };
    this.userInfoCache.set(senderId, userInfo);

    const chatId = msg.chat_id || '';
    const messageId = msg.message_id || uuid();
    const parentId = msg.parent_id || undefined;
    const mentions = msg.mentions || [];

    const mentionList: string[] = mentions
      .map(m => m.id?.open_id || m.id?.user_id || '')
      .filter(Boolean);
    // Command trigger: user @'s themselves in the group (design: @自己 交班/接班/取消/草稿)
    const mentionsSelf = mentionList.includes(senderId);
    const mentionsBot = this.botOpenId ? mentionList.includes(this.botOpenId) : false;

    let content: Message['content'];
    let type: Message['type'];

    switch (msg.msg_type) {
      case 'text': {
        type = 'text';
        let text = '';
        try {
          const parsed = JSON.parse(msg.content || '{}');
          text = parsed.text || '';
        } catch {
          text = msg.content || '';
        }
        content = { type: 'text', text };
        break;
      }
      case 'image': {
        type = 'image';
        try {
          const data = await this.client.downloadImage(messageId);
          content = { type: 'image', data };
        } catch (err) {
          logger.warn(`下载图片失败 (${messageId}): ${err instanceof Error ? err.message : err}`);
          content = { type: 'image', data: Buffer.alloc(0) };
        }
        break;
      }
      case 'audio': {
        type = 'audio';
        try {
          const data = await this.client.downloadAudio(messageId);
          content = { type: 'audio', data };
        } catch (err) {
          logger.warn(`下载语音失败 (${messageId}): ${err instanceof Error ? err.message : err}`);
          content = { type: 'audio', data: Buffer.alloc(0) };
        }
        break;
      }
      default:
        type = 'unknown';
        content = { type: 'unknown' };
    }

    return {
      id: messageId,
      chatId,
      senderId,
      senderName,
      sender: userInfo,
      content,
      type,
      timestamp: Date.now(),
      mentionsBot,
      mentionsSelf,
      mentionList,
      parentId,
    };
  }

  parseCommand(message: Message): Command | null {
    if (message.type !== 'text') return null;

    const text = (message.content as { text: string }).text.trim();

    if (!message.mentionsSelf) return null;

    const keyword = text.replace(/@\S+/g, '').trim();

    switch (true) {
      case /交班/.test(keyword):
        return { type: 'HANDOVER_START', sender: message.sender };
      case /接班/.test(keyword):
        return { type: 'HANDOVER_ACCEPT', sender: message.sender };
      case /取消/.test(keyword):
        return { type: 'HANDOVER_CANCEL', sender: message.sender };
      case /草稿/.test(keyword):
        return { type: 'DRAFT_VIEW', sender: message.sender };
      default:
        return null;
    }
  }

  async getUserInfo(userId: string): Promise<UserInfo> {
    const cached = this.userInfoCache.get(userId);
    if (cached) return cached;

    const info = await this.client.getUserInfo(userId);
    const userInfo: UserInfo = { id: info.id, name: info.name };
    this.userInfoCache.set(userId, userInfo);
    return userInfo;
  }

  async getChatMembers(chatId: string): Promise<UserInfo[]> {
    const members = await this.client.getChatMembers(chatId);
    return members.map(m => ({ id: m.id, name: m.name }));
  }

  async sendMessage(chatId: string, message: MessageContent): Promise<void> {
    await this.client.sendMessage(chatId, message.text);
  }

  async sendCard(chatId: string, card: CardContent): Promise<string> {
    const cardPayload = this.buildCardPayload(card);
    return this.client.sendCard(chatId, cardPayload);
  }

  private buildCardPayload(card: CardContent): Record<string, unknown> {
    const elements: Record<string, unknown>[] = [];

    if (card.content) {
      elements.push({ tag: 'markdown', content: card.content });
    }

    if (card.footer) {
      elements.push({ tag: 'markdown', content: `---\n${card.footer}` });
    }

    if (card.elements) {
      for (const el of card.elements) {
        elements.push(this.buildCardElement(el));
      }
    }

    const payload: Record<string, unknown> = {
      config: { update_multi: true },
      elements,
    };

    if (card.title) {
      payload.header = {
        title: { tag: 'plain_text', content: card.title },
      };
    }

    return payload;
  }

  private buildCardElement(el: import('../types').CardElement): Record<string, unknown> {
    const result: Record<string, unknown> = { tag: el.tag };

    if (el.content) result.content = el.content;
    if (el.text) result.text = el.text;
    if (el.type) result.type = el.type;
    if (el.value) result.value = el.value;
    if (el.folded !== undefined) result.folded = el.folded;

    if (el.confirm) {
      result.confirm = {
        title: { tag: 'plain_text', content: el.confirm.title },
        content: { tag: 'plain_text', content: el.confirm.content },
      };
    }

    if (el.actions) {
      result.actions = el.actions.map(a => this.buildCardElement(a));
    }

    if (el.elements) {
      result.elements = el.elements.map(e => this.buildCardElement(e));
    }

    return result;
  }

  getClient(): FeishuClient {
    return this.client;
  }

  async fetchMessageContent(messageId: string): Promise<string | null> {
    try {
      const msg = await this.client.getMessage(messageId);
      if (!msg?.body) return null;
      const content = msg.body.content;
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (err) {
      logger.warn(`获取引用消息失败: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    await this.client.addReaction(messageId, emoji);
  }
}