import crypto from 'crypto';
import type { Request } from 'express';
import { loadChannelsConfig } from '../services/config-service';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

interface CachedPlatform {
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey?: string;
}

interface DecryptedPlatform {
  appId: string;
  encryptKey: string;
}

interface CachedConfig {
  platforms: { feishu?: CachedPlatform };
  channels: unknown[];
}

let cachedConfig: CachedConfig | null = null;
let configCacheExpiry = 0;
const CONFIG_CACHE_TTL = 30_000; // 30 seconds

// Cache decrypted values separately (TTL aligned with config cache)
let decryptedPlatform: DecryptedPlatform | null = null;

async function getConfig(): Promise<CachedConfig> {
  const now = Date.now();
  if (cachedConfig && now < configCacheExpiry) {
    return cachedConfig;
  }
  cachedConfig = await loadChannelsConfig();
  configCacheExpiry = now + CONFIG_CACHE_TTL;
  decryptedPlatform = null;
  return cachedConfig;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  configCacheExpiry = 0;
  decryptedPlatform = null;
}

export async function verifyFeishuSignature(req: Request): Promise<boolean> {
  const timestamp = req.headers['x-lark-request-timestamp'] as string | undefined;
  const nonce = req.headers['x-lark-request-nonce'] as string | undefined;
  const signature = req.headers['x-lark-signature'] as string | undefined;

  if (!timestamp || !nonce || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // Anti-replay: reject timestamps older than 5 minutes
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - ts) > 300) return false;

  const config = await getConfig();
  const feishuConfig = config.platforms.feishu;
  if (!feishuConfig) return false;

  // Feishu signature: SHA256(timestamp + nonce + encryptKey + body)
  // encryptKey is the "Encrypt Key" from Feishu developer console
  // If no separate encryptKey, use verificationToken as fallback
  // Both are stored encrypted; decrypt once and cache
  if (!decryptedPlatform) {
    try {
      const encKey = feishuConfig.encryptKey ? await decrypt(feishuConfig.encryptKey) : await decrypt(feishuConfig.verificationToken);
      decryptedPlatform = { appId: feishuConfig.appId, encryptKey: encKey };
    } catch (err) {
      // Fallback: use raw value if not encrypted (legacy data)
      logger.warn(`密钥解密失败，回退到明文值: ${err instanceof Error ? err.message : err}`);
      decryptedPlatform = { appId: feishuConfig.appId, encryptKey: feishuConfig.encryptKey || feishuConfig.verificationToken };
    }
  }
  const encryptKey = decryptedPlatform.encryptKey;

  // Use raw body for signature verification — JSON.stringify on parsed body
  // may produce different output (key order, whitespace, unicode) than what Feishu signed
  const body = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const content = timestamp + nonce + encryptKey + body;
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}