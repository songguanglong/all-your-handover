import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '../utils/logger';

export class GitManager {
  private repo: SimpleGit;
  private commitTimer: NodeJS.Timeout | null = null;
  private pendingMessages: string[] = [];

  constructor(dataPath: string) {
    this.repo = simpleGit(dataPath);
  }

  async init(): Promise<void> {
    if (!await this.repo.checkIsRepo()) {
      await this.repo.init();
      await this.repo.addConfig('user.name', 'All Your Handover');
      await this.repo.addConfig('user.email', 'bot@allyourhandover.com');
    }
  }

  async autoCommit(message: string): Promise<void> {
    this.pendingMessages.push(message);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(async () => {
      const messages = [...this.pendingMessages];
      this.pendingMessages = [];
      this.commitTimer = null;
      try {
        await this.repo.add('.');
        const msg = messages.length === 1
          ? messages[0]
          : `${messages[0]} 等 ${messages.length} 条操作`;
        try {
          await this.repo.commit(msg);
        } catch {
          // No changes to commit — not an error
        }
      } catch (err) {
        logger.error(`Git auto-commit failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 30000);
  }

  async flush(): Promise<void> {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    if (this.pendingMessages.length === 0) return;

    const messages = [...this.pendingMessages];
    this.pendingMessages = [];
    try {
      await this.repo.add('.');
      const msg = messages.length === 1
        ? messages[0]
        : `${messages[0]} 等 ${messages.length} 条操作`;
      try {
        await this.repo.commit(msg);
      } catch {
        // No changes to commit
      }
    } catch (err) {
      logger.error(`Git flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}