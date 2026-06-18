import fs from 'fs/promises';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '../utils/logger';

const GITIGNORE_CONTENT = [
  '# 自动生成 - 切勿手动修改',
  '',
  '# 加密信封密钥（envelope key）— 与加密的 API key/平台密钥同处会导致泄露失去意义',
  'config/.encryption-key',
  '',
  '# 原子写临时文件',
  '.tmp_*',
  '**/.tmp_*',
  '',
].join('\n');

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
    await this.ensureGitignore();
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

  /** 确保数据目录有 .gitignore，避免敏感文件入库 */
  private async ensureGitignore(): Promise<void> {
    const gitignorePath = path.join(this.dataPath, '.gitignore');
    try {
      await fs.access(gitignorePath);
    } catch {
      await fs.writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
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
