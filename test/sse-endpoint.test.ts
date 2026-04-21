import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import { registerH5Routes } from '../src/web/h5-api';
import { notifyDraftUpdate } from '../src/web/draft-events';

const TMP_DIR = path.join(__dirname, '__tmp_sse_test');

let server: ReturnType<import('http').Server>;
let baseUrl: string;

beforeEach(async () => {
  process.env.DATA_DIR = TMP_DIR;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  if (server) server.close();
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('SSE endpoint', () => {
  it('receives connected event on connection', async () => {
    const app = express();
    app.use(express.json());
    registerH5Routes(app, '/api/h5');

    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    const response = await fetch(`${baseUrl}/api/h5/draft/test/events`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    // Read initial connected event
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('connected');

    reader!.cancel();
  });

  it('receives update event when notifyDraftUpdate is called', async () => {
    const app = express();
    app.use(express.json());
    registerH5Routes(app, '/api/h5');

    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    const response = await fetch(`${baseUrl}/api/h5/draft/test/events`);
    const reader = response.body?.getReader()!;

    // Read connected event first
    await reader.read();

    // Trigger notification
    notifyDraftUpdate('test');

    // Read the update event
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('update');
    expect(text).toContain('test');

    reader.cancel();
  });
});