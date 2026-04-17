import { BaseLLMProvider } from './base-provider';

export class OpenAIProvider extends BaseLLMProvider {
  readonly type = 'openai';
  protected supportsImage = true;
  protected supportsAudio = false;

  override async initialize(config: import('../types').LLMProviderConfig): Promise<void> {
    await super.initialize(config);
  }
}