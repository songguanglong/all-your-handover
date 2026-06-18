import { GitManager } from './services/git-manager';
import { channelFactory } from './channels/channel-factory';
import { llmProviderFactory } from './llm/llm-provider-factory';
import { LLMQueue } from './llm/llm-queue';
import { initDirectories } from './utils/init';
import { logger } from './utils/logger';
import { getDataDir } from './utils/data-dir';
import { setAutoCommit as setDraftRawAutoCommit } from './services/draft-raw-service';
import { setAutoCommit as setDraftAnalysisAutoCommit } from './services/draft-analysis-service';
import { setAutoCommit as setDraftPreviewAutoCommit } from './services/draft-preview-service';
import { setAutoCommit as setHandoverAutoCommit } from './services/handover-service';
import { setAutoCommit as setSoulAutoCommit } from './services/soul-service';
import { setAutoCommit as setAgentsAutoCommit } from './services/agents-service';
import { setAutoCommit as setChannelMemoryAutoCommit } from './services/channel-memory-service';
import { setAutoCommit as setExperienceAutoCommit } from './services/experience-service';
import { setAutoCommit as setDreamAutoCommit } from './services/dream-service';
import { setAutoCommit as setConfigAutoCommit } from './services/config-service';
import { setDraftUpdateNotifier as setRecordNotifier } from './services/record-service';
import { notifyDraftUpdate } from './web/draft-events';

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
    setDraftRawAutoCommit(gitAutoCommit);
    setDraftAnalysisAutoCommit(gitAutoCommit);
    setDraftPreviewAutoCommit(gitAutoCommit);
    setHandoverAutoCommit(gitAutoCommit);
    setSoulAutoCommit(gitAutoCommit);
    setAgentsAutoCommit(gitAutoCommit);
    setChannelMemoryAutoCommit(gitAutoCommit);
    setExperienceAutoCommit(gitAutoCommit);
    setDreamAutoCommit(gitAutoCommit);
    setConfigAutoCommit(gitAutoCommit);

    // Wire draft update notifier to SSE event bus
    setRecordNotifier(notifyDraftUpdate);

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