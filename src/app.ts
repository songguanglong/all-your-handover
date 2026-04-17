import { GitManager } from './services/git-manager';
import { channelFactory } from './channels/channel-factory';
import { llmProviderFactory } from './llm/llm-provider-factory';
import { LLMQueue } from './llm/llm-queue';
import { initDirectories } from './utils/init';
import { logger } from './utils/logger';
import { getDataDir } from './utils/data-dir';
import { setAutoCommit as setDraftAutoCommit } from './services/draft-service';
import { setAutoCommit as setHandoverAutoCommit } from './services/handover-service';

// Global app instance
let appInstance: App | null = null;

export class App {
  git: GitManager;
  llmQueue: LLMQueue;
  private _initialized = false;

  constructor() {
    const dataDir = getDataDir();
    this.git = new GitManager(dataDir);
    this.llmQueue = new LLMQueue({ maxGlobalConcurrency: 3 });
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Initialize directories
    await initDirectories();

    // Initialize Git
    await this.git.init();

    // Wire up auto-commit to GitManager
    const gitAutoCommit = this.git.autoCommit.bind(this.git);
    setDraftAutoCommit(gitAutoCommit);
    setHandoverAutoCommit(gitAutoCommit);

    // Initialize providers
    try {
      await llmProviderFactory.initializeAll();
    } catch (err) {
      logger.error(`LLM Provider 初始化失败: ${err}`);
    }

    // Initialize channels
    try {
      await channelFactory.initializeAll();
    } catch (err) {
      logger.error(`渠道初始化失败: ${err}`);
    }

    this._initialized = true;
    appInstance = this;
    logger.info('App 初始化完成');
  }

  getChannelFactory() { return channelFactory; }
  getLLMProviderFactory() { return llmProviderFactory; }
}

export function getApp(): App | null {
  return appInstance;
}