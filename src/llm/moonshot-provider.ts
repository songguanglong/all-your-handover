import { BaseLLMProvider } from './base-provider';

export class MoonshotProvider extends BaseLLMProvider {
  readonly type = 'moonshot';
  protected supportsImage = true;
  protected supportsAudio = false;

  override async initialize(config: import('../types').LLMProviderConfig): Promise<void> {
    await super.initialize(config);
  }
}