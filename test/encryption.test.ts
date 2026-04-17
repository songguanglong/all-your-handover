import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { encrypt, decrypt, encryptSync, decryptSync } from '../src/utils/encryption';

const TMP_DIR = path.join(__dirname, '__tmp_enc_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
  delete process.env.ENCRYPTION_KEY;
});

afterEach(async () => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('encryption', () => {
  describe('async (with key file)', () => {
    it('encrypts and decrypts a string round-trip', async () => {
      const plaintext = 'sk-1234567890abcdef';
      const encrypted = await encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':');
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const plaintext = 'same-value';
      const enc1 = await encrypt(plaintext);
      const enc2 = await encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('persists key file so decryption works across calls', async () => {
      const plaintext = 'secret-api-key';
      const encrypted = await encrypt(plaintext);
      // Second call should use same key file
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('sync (with env var, for tests)', () => {
    it('encrypts and decrypts with env key', () => {
      process.env.ENCRYPTION_KEY = 'test-key-123';
      const plaintext = 'secret-api-key';
      const encrypted = encryptSync(plaintext);
      const decrypted = decryptSync(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('fails to decrypt with wrong key', () => {
      process.env.ENCRYPTION_KEY = 'key-a';
      const encrypted = encryptSync('secret');
      process.env.ENCRYPTION_KEY = 'key-b';
      expect(() => decryptSync(encrypted)).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => decryptSync('not-valid')).toThrow('Invalid encrypted format');
      expect(() => decryptSync('a:b:c:d')).toThrow('Invalid encrypted format');
    });
  });
});