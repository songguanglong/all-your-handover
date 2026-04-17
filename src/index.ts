import { startServer } from './server';
import { GitManager } from './services/git-manager';
import { initDirectories } from './utils/init';
import { registerService } from './utils/service';

async function main() {
  // 初始化数据目录
  await initDirectories();

  // 初始化 Git
  const git = new GitManager(process.env.DATA_DIR || './data');
  await git.init();

  // 注册系统服务（可选，需管理员权限）
  await registerService();

  // 启动 Web 服务
  const port = parseInt(process.env.PORT || '3000', 10);
  await startServer(port);
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});