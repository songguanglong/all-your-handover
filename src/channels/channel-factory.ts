import type { ChannelAdapter, ChannelConfig, PlatformConfig } from '../types';
import { FeishuAdapter } from './feishu-adapter';
import { loadChannelsConfig } from '../services/config-service';
import { logger } from '../utils/logger';

class ChannelFactory {
  adapters: Map<string, ChannelAdapter> = new Map();

  async initializeAll(): Promise<void> {
    const config = await loadChannelsConfig();

    for (const ch of config.channels) {
      if (!ch.isEnabled) continue;
      try {
        await this.createAdapter(ch, config.platforms);
        logger.info(`渠道初始化: ${ch.name} (${ch.code})`);
      } catch (err) {
        logger.error(`渠道初始化失败: ${ch.name} - ${err}`);
      }
    }
  }

  async createAdapter(ch: ChannelConfig, platforms: Record<string, unknown>): Promise<ChannelAdapter> {
    let adapter: ChannelAdapter;
    let platform: PlatformConfig;

    switch (ch.type) {
      case 'feishu': {
        adapter = new FeishuAdapter(ch.code, ch.name);
        platform = platforms.feishu as PlatformConfig;
        break;
      }
      default:
        throw new Error(`Unknown channel type: ${ch.type}`);
    }

    await adapter.initialize({ platform, chatId: ch.chatId });
    this.adapters.set(ch.code, adapter);
    return adapter;
  }

  get(channelCode: string): ChannelAdapter {
    const adapter = this.adapters.get(channelCode);
    if (!adapter) {
      throw new Error(`Channel not found: ${channelCode}`);
    }
    return adapter;
  }

  async reload(): Promise<void> {
    this.adapters.clear();
    await this.initializeAll();
  }

  list(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const channelFactory = new ChannelFactory();