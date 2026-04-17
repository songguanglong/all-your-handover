import type { Request, Response } from 'express';
import type { PlatformConfig, FeishuPlatformConfig } from '../types';
import { loadChannelsConfig, saveChannelsConfig } from '../services/config-service';
import { encrypt, decrypt } from '../utils/encryption';
import { invalidateConfigCache } from '../channels/feishu-signature';
import { logger } from '../utils/logger';

// Validate platform type against known types
const VALID_PLATFORM_TYPES = ['feishu', 'wecom', 'dingtalk'];

function sanitizeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal error';
}

export function registerPlatformRoutes(router: import('express').Router, prefix: string): void {
  // Get platform config (with secrets masked)
  router.get(`${prefix}/platforms/:type`, async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      if (!VALID_PLATFORM_TYPES.includes(type)) {
        return res.status(400).json({ code: -1, message: `Invalid platform type: ${type}` });
      }

      const config = await loadChannelsConfig();
      const platforms = config.platforms as Record<string, Record<string, string>>;
      const platform = platforms[type];
      if (!platform) return res.json({ code: 0, data: null });

      // Mask all secrets in GET response
      const masked = { ...platform };
      if (masked.appSecret) masked.appSecret = '***masked***';
      if (masked.verificationToken) masked.verificationToken = '***masked***';
      if (masked.encryptKey) masked.encryptKey = '***masked***';

      res.json({ code: 0, data: masked });
    } catch (err) {
      logger.error(`Get platform config error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Update platform config
  router.put(`${prefix}/platforms/:type`, async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      if (!VALID_PLATFORM_TYPES.includes(type)) {
        return res.status(400).json({ code: -1, message: `Invalid platform type: ${type}` });
      }

      const config = await loadChannelsConfig();
      const platforms = config.platforms as unknown as Record<string, Partial<FeishuPlatformConfig>>;
      const existing = platforms[type] || {};
      const updates = req.body;

      // Encrypt all secrets
      const merged = { ...existing };
      if (updates.appId) merged.appId = String(updates.appId).slice(0, 100);
      if (updates.appSecret) merged.appSecret = await encrypt(String(updates.appSecret));
      if (updates.verificationToken) merged.verificationToken = await encrypt(String(updates.verificationToken));
      if (updates.encryptKey) merged.encryptKey = String(updates.encryptKey).slice(0, 100);

      platforms[type] = merged;
      config.platforms = platforms as unknown as Record<string, PlatformConfig>;
      await saveChannelsConfig(config);
      invalidateConfigCache();

      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Update platform config error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Test platform connection
  router.post(`${prefix}/platforms/:type/test`, async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      if (type !== 'feishu') {
        return res.status(400).json({ code: -1, message: `不支持的平台类型: ${type}` });
      }

      const config = await loadChannelsConfig();
      const feishuConfig = config.platforms.feishu;
      if (!feishuConfig) {
        return res.status(404).json({ code: -1, message: '飞书平台未配置' });
      }

      try {
        const { FeishuClient } = await import('../channels/feishu-client');
        const client = new FeishuClient();
        // Decrypt secrets
        let appSecret = feishuConfig.appSecret;
        try { appSecret = await decrypt(appSecret); } catch { /* not encrypted or different key */ }
        let verificationToken = feishuConfig.verificationToken;
        try { verificationToken = await decrypt(verificationToken); } catch { /* not encrypted */ }
        await client.initialize({ appId: feishuConfig.appId, appSecret, verificationToken });
        await client.getTenantToken();
        res.json({ code: 0, message: '连接成功' });
      } catch (err) {
        res.json({ code: -1, message: `连接失败: ${err instanceof Error ? err.message : String(err)}` });
      }
    } catch (err) {
      logger.error(`Test platform error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}