import type { LLMProvider, LLMProviderConfig, LLMRoutesConfig } from '../types';
import { BaseLLMProvider } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { MoonshotProvider } from './moonshot-provider';
import { loadLLMProvidersConfig } from '../services/config-service';
import { logger } from '../utils/logger';

const providerClasses: Record<string, new () => BaseLLMProvider> = {
  openai: OpenAIProvider,
  deepseek: DeepSeekProvider,
  moonshot: MoonshotProvider,
};

class LLMProviderFactory {
  providers: Map<string, LLMProvider> = new Map();
  defaultProviderId: string | null = null;
  routes: LLMRoutesConfig = {};
  initialized = false;

  async initializeAll(): Promise<void> {
    const config = await loadLLMProvidersConfig();
    this.defaultProviderId = config.defaultProviderId;
    this.routes = config.routes || {};

    for (const pc of config.providers) {
      if (!pc.isEnabled) continue;
      try {
        await this.create(pc);
        logger.info(`LLM Provider 初始化: ${pc.name} (${pc.id})`);
      } catch (err) {
        logger.error(`LLM Provider 初始化失败: ${pc.name} - ${err}`);
      }
    }
    this.initialized = true;
  }

  async create(config: LLMProviderConfig): Promise<LLMProvider> {
    const Cls = providerClasses[config.type];
    if (!Cls) {
      throw new Error(`Unknown provider type: ${config.type}`);
    }
    const provider = new Cls();
    await provider.initialize(config);
    this.providers.set(config.id, provider);
    return provider;
  }

  getDefault(): LLMProvider {
    if (!this.defaultProviderId) {
      throw new Error('No default LLM provider configured');
    }
    return this.get(this.defaultProviderId);
  }

  get(id: string): LLMProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`LLM provider not found: ${id}`);
    }
    return provider;
  }

  async reload(): Promise<void> {
    this.providers.clear();
    this.defaultProviderId = null;
    await this.initializeAll();
  }

  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  hasDefault(): boolean {
    return this.defaultProviderId != null && this.providers.has(this.defaultProviderId);
  }

  /** Get provider for a specific task, using routes config if available */
  getForTask(task: 'analyze' | 'review'): LLMProvider | null {
    const route = this.routes[task];
    if (route?.providerId) {
      const provider = this.providers.get(route.providerId);
      if (provider) return provider;
    }
    // Fallback to default
    if (this.hasDefault()) return this.getDefault();
    return null;
  }

  /** Get route config for a task */
  getRouteConfig(task: 'analyze' | 'review'): LLMRoutesConfig['analyze'] | LLMRoutesConfig['review'] {
    return this.routes[task];
  }
}

export const llmProviderFactory = new LLMProviderFactory();