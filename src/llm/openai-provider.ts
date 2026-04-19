import { BaseLLMProvider } from './base-provider';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';
import { logger } from '../utils/logger';

export class OpenAIProvider extends BaseLLMProvider {
  readonly type = 'openai';
  protected supportsImage = true;
  protected supportsAudio = true;

  override async initialize(config: import('../types').LLMProviderConfig): Promise<void> {
    await super.initialize(config);
  }

  override async transcribeAudio(params: import('../types').TranscribeParams): Promise<string> {
    // Try multimodal chat completion with audio first
    try {
      return await super.transcribeAudio(params);
    } catch (err) {
      logger.warn(`OpenAI 多模态语音处理失败，回退到 Whisper: ${err instanceof Error ? err.message : err}`);
    }

    // Fallback: Whisper API
    const audioData = await fs.readFile(params.audioPath);
    const filename = params.audioPath.split('/').pop() || 'audio.opus';
    const boundary = `----FormBoundary${Date.now()}`;

    const parts: Buffer[] = [];
    // model field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
    // language hint for Chinese
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nzh\r\n`));
    // prompt field
    if (params.prompt) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${params.prompt}\r\n`));
    }
    // file field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(audioData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return new Promise((resolve, reject) => {
      const url = `${this.config.baseUrl}/audio/transcriptions`;
      const protocol = url.startsWith('https') ? https : http;

      const req = protocol.request(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 60000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.text || '');
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`Whisper API HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Whisper 请求超时 (60s)')); });
      req.write(body);
      req.end();
    });
  }
}
