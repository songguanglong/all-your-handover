import https from 'https';
import http from 'http';
import type { FeishuPlatformConfig } from '../types';
import { logger } from '../utils/logger';

function request(url: string, options: { method: string; headers: Record<string, string>; timeout?: number }, body?: string): Promise<string> {
  const timeout = options.timeout ?? 10000;
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, { ...options, timeout }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`请求超时 (${timeout}ms)`)); });
    if (body) req.write(body);
    req.end();
  });
}

export class FeishuClient {
  private config!: FeishuPlatformConfig;
  private tenantToken: string = '';
  private tokenExpiresAt = 0;
  private botInfo: { appId: string; openId: string } | null = null;

  async initialize(config: FeishuPlatformConfig): Promise<void> {
    this.config = config;
  }

  async getTenantToken(): Promise<string> {
    const now = Date.now();
    if (this.tenantToken && now < this.tokenExpiresAt) {
      return this.tenantToken;
    }

    const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
    const body = JSON.stringify({
      app_id: this.config.appId,
      app_secret: this.config.appSecret,
    });

    const response = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, body);

    const data = JSON.parse(response);
    if (data.code !== 0) {
      throw new Error(`Feishu token error: ${data.msg}`);
    }

    this.tenantToken = data.tenant_access_token;
    this.tokenExpiresAt = now + (data.expire - 300) * 1000; // refresh 5 min before expiry
    return this.tenantToken;
  }

  async getBotInfo(): Promise<{ appId: string; openId: string }> {
    if (this.botInfo) return this.botInfo;

    const token = await this.getTenantToken();
    const url = 'https://open.feishu.cn/open-apis/bot/v3/info';
    const response = await request(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = JSON.parse(response);
    if (data.code !== 0) {
      throw new Error(`Feishu bot info error: ${data.msg}`);
    }

    this.botInfo = {
      appId: data.bot.app_id,
      openId: data.bot.open_id,
    };
    return this.botInfo;
  }

  async getUserInfo(userId: string): Promise<{ id: string; name: string }> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/contact/v3/users/${userId}?user_id_type=open_id`;
    const response = await request(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = JSON.parse(response);
    if (data.code !== 0) {
      logger.error(`Feishu getUserInfo error: ${data.msg}`);
      return { id: userId, name: userId };
    }

    return {
      id: data.data.user.open_id,
      name: data.data.user.name || userId,
    };
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = await this.getTenantToken();
    const url = 'https://open.feishu.cn/open-apis/im/v1/messages';
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    });

    await request(`${url}?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, body);
  }

  async sendCard(chatId: string, card: Record<string, unknown>): Promise<string> {
    const token = await this.getTenantToken();
    const url = 'https://open.feishu.cn/open-apis/im/v1/messages';
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    });

    const response = await request(`${url}?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, body);

    const data = JSON.parse(response);
    return data.data?.message_id || '';
  }

  async downloadImage(messageId: string): Promise<Buffer> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/image`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      }, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`Feishu download image failed: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
    });
  }

  async downloadAudio(messageId: string): Promise<Buffer> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/file`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      }, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`Feishu download audio failed: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
    });
  }

  async updateCard(messageId: string, card: Record<string, unknown>): Promise<void> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`;
    const body = JSON.stringify({ content: JSON.stringify(card) });

    await request(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, body);
  }

  async getChatMembers(chatId: string): Promise<Array<{ id: string; name: string }>> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/chats/${chatId}/members?page_size=100`;

    const response = await request(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = JSON.parse(response);
    if (data.code !== 0) {
      logger.error(`Feishu getChatMembers error: ${data.msg}`);
      return [];
    }

    return (data.data?.items || []).map((item: Record<string, unknown>) => ({
      id: item.member_id,
      name: item.name || item.member_id,
    }));
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reactions`;
    const body = JSON.stringify({ reaction_type: { emoji_type: emoji } });

    await request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, body);
  }

  async getMessage(messageId: string): Promise<{ body: Record<string, unknown> | null }> {
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = JSON.parse(response);
      if (data.code !== 0) {
        logger.warn(`Feishu getMessage error: ${data.msg}`);
        return { body: null };
      }

      const items = data.data?.items;
      if (items && items.length > 0) {
        return { body: items[0] };
      }
      return { body: data.data?.body || null };
    } catch (err) {
      logger.warn(`Feishu getMessage failed: ${err instanceof Error ? err.message : err}`);
      return { body: null };
    }
  }
}