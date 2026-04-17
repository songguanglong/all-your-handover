import simpleGit, { SimpleGit } from 'simple-git';

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
      await this.repo.add('.');
      const msg = this.pendingMessages.length === 1
        ? this.pendingMessages[0]
        : `${this.pendingMessages[0]} 等 ${this.pendingMessages.length} 条操作`;
      await this.repo.commit(msg);
      this.pendingMessages = [];
      this.commitTimer = null;
    }, 30000);
  }
}