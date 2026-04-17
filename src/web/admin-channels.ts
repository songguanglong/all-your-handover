import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { loadChannelsConfig, saveChannelsConfig } from '../services/config-service';
import { channelFactory } from '../channels/channel-factory';
import { logger } from '../utils/logger';

import { getDataDir } from '../utils/data-dir';
function sanitizeError(err: unknown): string { return err instanceof Error ? err.message : 'Internal error'; }

export function registerChannelRoutes(router: import('express').Router, prefix: string): void {
  router.get(`${prefix}/channels`, async (_req: Request, res: Response) => {
    try {
      const config = await loadChannelsConfig();
      res.json({ code: 0, data: config.channels });
    } catch (err) {
      logger.error(`List channels error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.post(`${prefix}/channels`, async (req: Request, res: Response) => {
    try {
      const { code, type, name, chatId, settings } = req.body;
      if (!code || !type || !name || !chatId) {
        return res.status(400).json({ code: -1, message: 'Missing required fields' });
      }
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(code)) {
        return res.status(400).json({ code: -1, message: 'Channel code must be 1-50 chars: letters, digits, underscore only' });
      }
      if (!['feishu', 'wecom', 'dingtalk'].includes(type)) {
        return res.status(400).json({ code: -1, message: `Invalid channel type: ${type}` });
      }
      if (String(name).length > 100 || String(chatId).length > 200) {
        return res.status(400).json({ code: -1, message: 'Name or chatId too long' });
      }

      const config = await loadChannelsConfig();
      if (config.channels.find(ch => ch.code === code)) {
        return res.status(400).json({ code: -1, message: 'Channel code already exists' });
      }

      const channel = {
        code: String(code),
        type: String(type),
        name: String(name),
        chatId: String(chatId),
        settings: settings || { requireAccept: true, messageFilter: 'all' as const },
        isEnabled: true,
      };

      config.channels.push(channel);
      await saveChannelsConfig(config);

      const channelDir = path.join(getDataDir(), `channels/${code}`);
      await fs.mkdir(path.join(channelDir, 'drafts'), { recursive: true });
      await fs.mkdir(path.join(channelDir, 'handovers'), { recursive: true });
      await fs.mkdir(path.join(channelDir, 'media/images'), { recursive: true });
      await fs.mkdir(path.join(channelDir, 'media/audio'), { recursive: true });

      try { await channelFactory.reload(); } catch (err) { logger.error(`Channel reload error: ${err}`); }

      res.json({ code: 0, data: channel });
    } catch (err) {
      logger.error(`Create channel error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.put(`${prefix}/channels/:code`, async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const config = await loadChannelsConfig();
      const idx = config.channels.findIndex(ch => ch.code === code);
      if (idx === -1) return res.status(404).json({ code: -1, message: 'Channel not found' });

      const updates = req.body;
      config.channels[idx] = {
        ...config.channels[idx],
        name: updates.name ? String(updates.name).slice(0, 100) : config.channels[idx].name,
        chatId: updates.chatId ? String(updates.chatId).slice(0, 200) : config.channels[idx].chatId,
        settings: updates.settings ?? config.channels[idx].settings,
        isEnabled: updates.isEnabled ?? config.channels[idx].isEnabled,
      };

      await saveChannelsConfig(config);
      try { await channelFactory.reload(); } catch (err) { logger.error(`Channel reload error: ${err}`); }

      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Update channel error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.delete(`${prefix}/channels/:code`, async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const config = await loadChannelsConfig();
      config.channels = config.channels.filter(ch => ch.code !== code);
      await saveChannelsConfig(config);
      try { await channelFactory.reload(); } catch (err) { logger.error(`Channel reload error: ${err}`); }
      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Delete channel error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.put(`${prefix}/channels/:code/toggle`, async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const config = await loadChannelsConfig();
      const channel = config.channels.find(ch => ch.code === code);
      if (!channel) return res.status(404).json({ code: -1, message: 'Channel not found' });
      channel.isEnabled = !channel.isEnabled;
      await saveChannelsConfig(config);
      try { await channelFactory.reload(); } catch (err) { logger.error(`Channel reload error: ${err}`); }
      res.json({ code: 0, data: { isEnabled: channel.isEnabled } });
    } catch (err) {
      logger.error(`Toggle channel error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}