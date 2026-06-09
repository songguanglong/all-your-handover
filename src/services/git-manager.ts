import fs from 'fs/promises';
import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '../utils/logger';

export class GitManager {
  private repo: SimpleGit | null = null;
  private dataPath: string;
  private gitAvailable = true;
  private commitTimer: NodeJS.Timeout | null = null;
  private pendingMessages: string[] = [];

  constructor(dataPath: string) {
    this.dataPath = dataPath;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataPath, { recursive: true });
    this.repo = simpleGit(this.dataPath);
    try {
      if (!await this.repo.checkIsRepo()) {
        await this.repo.init();
        await this.repo.addConfig('user.name', 'All Your Handover');
        await this.repo.addConfig('user.email', 'bot@allyourhandover.com');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT') || msg.includes('spawn')) {
        logger.warn('系统未安装 Git，已降级为纯文件模式（数据正常写入，无版本控制）');
        this.gitAvailable = false;
        return;
      }
      throw err;
    }
  }

  async autoCommit(message: string): Promise<void> {
    if (!this.gitAvailable || !this.repo) return;
    this.pendingMessages.push(message);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(async () => {
      const messages = [...this.pendingMessages];
      this.pendingMessages = [];
      this.commitTimer = null;
      try {
        await this.repo!.add('.');
        const msg = messages.length === 1
          ? messages[0]
          : `${messages[0]} 等 ${messages.length} 条操作`;
        try {
          await this.repo!.commit(msg);
        } catch {
          // No changes to commit — not an error
        }
      } catch (err) {
        logger.error(`Git auto-commit failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 30000);
  }

  async flush(): Promise<void> {
    if (!this.gitAvailable || !this.repo) return;
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    if (this.pendingMessages.length === 0) return;

    const messages = [...this.pendingMessages];
    this.pendingMessages = [];
    try {
      await this.repo!.add('.');
      const msg = messages.length === 1
        ? messages[0]
        : `${messages[0]} 等 ${messages.length} 条操作`;
      try {
        await this.repo!.commit(msg);
      } catch {
        // No changes to commit
      }
    } catch (err) {
      logger.error(`Git flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
