import { BaseLLMProvider } from './base-provider';

export class DeepSeekProvider extends BaseLLMProvider {
  readonly type = 'deepseek';
  protected supportsImage = false;
  protected supportsAudio = false;

  override async initialize(config: import('../types').LLMProviderConfig): Promise<void> {
    await super.initialize(config);
  }
}