import https from 'https';
import http from 'http';
import type {
  LLMProvider,
  LLMProviderConfig,
  AnalyzeTextParams,
  AnalyzeImageParams,
  TranscribeParams,
  GenerateHandoverParams,
  AnalyzeResult,
} from '../types';
import { logger } from '../utils/logger';

function request(url: string, options: { method: string; headers: Record<string, string>; timeout?: number }, body?: string): Promise<string> {
  const timeout = options.timeout ?? 60000;
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, { ...options, timeout }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`请求超时 (${timeout}ms)`)); });
    if (body) req.write(body);
    req.end();
  });
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly type: string;
  id = '';
  name = '';

  protected config!: LLMProviderConfig;
  protected supportsImage = false;
  protected supportsAudio = false;

  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
  }

  async analyzeText(params: AnalyzeTextParams): Promise<AnalyzeResult> {
    const messages = [
      { role: 'system', content: params.prompt },
      { role: 'user', content: params.text },
    ];
    const result = await this.chatCompletion(messages);
    return this.parseAnalyzeResult(result);
  }

  async analyzeImage(params: AnalyzeImageParams): Promise<AnalyzeResult> {
    if (!this.supportsImage) {
      return { category: '图片', content: '当前 Provider 不支持图片分析', urgency: 'low' };
    }
    const fs = await import('fs/promises');
    const imageBuffer = await fs.readFile(params.imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = params.imagePath.split('.').pop()?.toLowerCase() ?? 'jpeg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    const messages = [
      { role: 'system', content: params.prompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ];
    const result = await this.chatCompletion(messages);
    return this.parseAnalyzeResult(result);
  }

  async transcribeAudio(params: TranscribeParams): Promise<string> {
    if (!this.supportsAudio) {
      return '[当前 Provider 不支持语音处理]';
    }
    // Try multimodal chat completion with audio input
    const fs = await import('fs/promises');
    const audioBuffer = await fs.readFile(params.audioPath);
    const base64 = audioBuffer.toString('base64');
    const ext = params.audioPath.split('.').pop()?.toLowerCase() ?? 'opus';
    const format = ext === 'mp3' ? 'mp3' : ext === 'wav' ? 'wav' : ext === 'm4a' ? 'm4a' : 'opus';

    const messages = [
      { role: 'system', content: params.prompt },
      {
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: base64, format } },
        ],
      },
    ];
    return this.chatCompletion(messages);
  }

  async generateHandover(params: GenerateHandoverParams): Promise<string> {
    const systemPrompt = params.systemPrompt
      || '你是一个交接班助手。请根据以下模版和草稿内容，生成交接班记录。保持模版结构，用实际内容替换占位符。';

    let contextBlock = '';
    if (params.previousHandover) {
      const dateLabel = params.previousHandover.date || '未知';
      contextBlock = `\n\n--- 上一班交接记录 ---\n日期: ${dateLabel}\n${params.previousHandover.body}\n---`;
    }

    const messages = [
      { role: 'system', content: `${systemPrompt}\n\n模版:\n${params.template}${contextBlock}` },
      { role: 'user', content: `草稿内容:\n${params.draft}` },
    ];
    return this.chatCompletion(messages);
  }

  async chatCompletion(messages: Array<{ role: string; content: string | unknown[] }>): Promise<string> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      temperature: 0.7,
    });

    const response = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    }, body);

    const data = JSON.parse(response);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }
    return content;
  }

  protected parseAnalyzeResult(text: string): AnalyzeResult {
    // Try to extract structured result from LLM response
    // If it looks like JSON, parse it; otherwise treat as text
    try {
      const json = JSON.parse(text);
      if (json.category && json.content) {
        return {
          category: json.category,
          content: json.content,
          urgency: json.urgency || 'normal',
        };
      }
    } catch {
      // Not JSON, parse as text
    }

    // Try to extract category from text patterns like [客房] or 【前台】
    const categoryMatch = text.match(/[\[【](.+?)[\]】]/);
    const category = categoryMatch ? categoryMatch[1] : '其他';

    // Detect urgency
    let urgency: 'high' | 'normal' | 'low' = 'normal';
    if (/紧急|重要|urgent|high/i.test(text)) urgency = 'high';
    else if (/低|low/i.test(text)) urgency = 'low';

    return { category, content: text.trim(), urgency };
  }
}