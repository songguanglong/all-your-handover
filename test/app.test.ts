import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { App } from '../src/app';

const TMP_DIR = path.join(__dirname, '__tmp_app_test');

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  await fs.mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('App', () => {
  it('initializes without error', async () => {
    const app = new App();
    await app.initialize();
    expect(app.git).toBeDefined();
    expect(app.llmQueue).toBeDefined();
  });

  it('provides access to factories', async () => {
    const app = new App();
    await app.initialize();
    expect(app.getChannelFactory()).toBeDefined();
    expect(app.getLLMProviderFactory()).toBeDefined();
  });
});