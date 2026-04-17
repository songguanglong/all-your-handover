import crypto from 'crypto';
import type { Request } from 'express';
import { loadChannelsConfig } from '../services/config-service';
import { decrypt } from '../utils/encryption';

interface CachedPlatform {
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey?: string;
}

interface CachedConfig {
  platforms: { feishu?: CachedPlatform };
  channels: unknown[];
}

let cachedConfig: CachedConfig | null = null;
let configCacheExpiry = 0;
const CONFIG_CACHE_TTL = 30_000; // 30 seconds

async function getConfig(): Promise<CachedConfig> {
  const now = Date.now();
  if (cachedConfig && now < configCacheExpiry) {
    return cachedConfig;
  }
  cachedConfig = await loadChannelsConfig();
  configCacheExpiry = now + CONFIG_CACHE_TTL;
  return cachedConfig;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  configCacheExpiry = 0;
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
  const encryptKey = feishuConfig.encryptKey || feishuConfig.verificationToken;

  // Get raw request body for signature verification
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const content = timestamp + nonce + encryptKey + body;
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}