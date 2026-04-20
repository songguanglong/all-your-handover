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
  ThinkingMode,
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

  async analyzeText(params: AnalyzeTextParams & { soulPrompt?: string }): Promise<AnalyzeResult> {
    const systemContent = params.soulPrompt
      ? `${params.soulPrompt}\n\n${params.prompt}`
      : params.prompt;
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: params.text },
    ];
    const result = await this.chatCompletion(messages, 'quick');
    return this.parseAnalyzeResult(result);
  }

  async analyzeImage(params: AnalyzeImageParams & { soulPrompt?: string }): Promise<AnalyzeResult> {
    if (!this.supportsImage) {
      return { category: '图片', content: '当前 Provider 不支持图片分析', urgency: 'low' };
    }
    const fs = await import('fs/promises');
    const imageBuffer = await fs.readFile(params.imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = params.imagePath.split('.').pop()?.toLowerCase() ?? 'jpeg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    const systemContent = params.soulPrompt
      ? `${params.soulPrompt}\n\n${params.prompt}`
      : params.prompt;

    const messages = [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ];
    const result = await this.chatCompletion(messages, 'quick');
    return this.parseAnalyzeResult(result);
  }

  async transcribeAudio(params: TranscribeParams & { soulPrompt?: string }): Promise<string> {
    if (!this.supportsAudio) {
      return '[当前 Provider 不支持语音处理]';
    }
    const fs = await import('fs/promises');
    const audioBuffer = await fs.readFile(params.audioPath);
    const base64 = audioBuffer.toString('base64');
    const ext = params.audioPath.split('.').pop()?.toLowerCase() ?? 'opus';
    const format = ext === 'mp3' ? 'mp3' : ext === 'wav' ? 'wav' : ext === 'm4a' ? 'm4a' : 'opus';

    const systemContent = params.soulPrompt
      ? `${params.soulPrompt}\n\n${params.prompt}`
      : params.prompt;

    const messages = [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: base64, format } },
        ],
      },
    ];
    return this.chatCompletion(messages, 'quick');
  }

  async generateHandover(params: GenerateHandoverParams): Promise<string> {
    const systemPrompt = params.systemPrompt
      || '你是一个交接班助手。请根据以下模版和草稿内容，生成交接班记录。保持模版结构，用实际内容替换占位符。';

    const parts: string[] = [systemPrompt];

    if (params.soulPrompt) {
      parts.push(params.soulPrompt);
    }

    parts.push(`模版:\n${params.template}`);

    if (params.previousHandover) {
      const dateLabel = params.previousHandover.date || '未知';
      parts.push(`--- 上一班交接记录 ---\n日期: ${dateLabel}\n${params.previousHandover.body}\n---`);
    }

    if (params.experiencePrompt) {
      parts.push(params.experiencePrompt);
    }

    const messages = [
      { role: 'system', content: parts.join('\n\n') },
      { role: 'user', content: `草稿内容:\n${params.draft}` },
    ];
    return this.chatCompletion(messages, 'deep');
  }

  async chatCompletion(messages: Array<{ role: string; content: string | unknown[] }>, thinkingMode?: ThinkingMode): Promise<string> {
    const config = this.getThinkingConfig(thinkingMode);
    const url = `${this.config.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      temperature: config.temperature,
      ...(config.maxTokens && { max_tokens: config.maxTokens }),
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

  private getThinkingConfig(mode?: ThinkingMode): { temperature: number; maxTokens?: number } {
    const configs: Record<ThinkingMode, { temperature: number; maxTokens?: number }> = {
      quick:    { temperature: 0.3, maxTokens: 512 },
      standard: { temperature: 0.7 },
      deep:     { temperature: 0.8, maxTokens: 4096 },
    };
    return configs[mode || 'standard'];
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