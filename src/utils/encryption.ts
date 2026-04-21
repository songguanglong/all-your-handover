import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const MIN_KEY_LENGTH = 16;

import { getDataDir } from './data-dir';
import { logger } from './logger';

async function deriveKey(): Promise<Buffer> {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length < MIN_KEY_LENGTH) {
      logger.warn(`ENCRYPTION_KEY 过短 (${envKey.length} 字符)，建议使用 ${MIN_KEY_LENGTH} 字符以上的密钥`);
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }

  // Fallback: derive from a machine-specific key file, or generate one
  const keyPath = path.join(getDataDir(), 'config/.encryption-key');
  try {
    const existing = await fs.readFile(keyPath, 'utf-8');
    return Buffer.from(existing.trim(), 'hex');
  } catch {
    // First run: generate a strong random key and persist it
    const newKey = crypto.randomBytes(32);
    await fs.mkdir(path.dirname(keyPath), { recursive: true });
    await fs.writeFile(keyPath, newKey.toString('hex'), { mode: 0o600 });
    logger.warn('未设置 ENCRYPTION_KEY 环境变量，已自动生成加密密钥。生产环境请设置 ENCRYPTION_KEY');
    return newKey;
  }
}

// Cache the derived key to avoid re-reading the file on every call
let cachedKey: Buffer | null = null;

export async function getKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  cachedKey = await deriveKey();
  return cachedKey;
}

export function invalidateKeyCache(): void {
  cachedKey = null;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Synchronous versions for backwards compat (used in tests)
// These use the env-var-only path, no file fallback
export function encryptSync(plaintext: string): string {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) throw new Error('ENCRYPTION_KEY env var required for sync encryption');
  if (envKey.length < MIN_KEY_LENGTH) {
    logger.warn(`ENCRYPTION_KEY 过短 (${envKey.length} 字符)`);
  }
  const key = crypto.createHash('sha256').update(envKey).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSync(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) throw new Error('ENCRYPTION_KEY env var required for sync decryption');
  const key = crypto.createHash('sha256').update(envKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}