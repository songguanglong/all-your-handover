import { App } from './app';
import { startServer } from './server';
import { logger } from './utils/logger';
import { registerService, unregisterService } from './utils/service';
import { setDataDir } from './utils/data-dir';

function parseArgs(args: string[]): { port: number; dataDir: string; command?: string } {
  let port = parseInt(process.env.PORT || '3000', 10);
  let dataDir = process.env.DATA_DIR || './data';
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port': {
        const val = args[i + 1];
        if (val && /^\d+$/.test(val)) {
          port = parseInt(val, 10);
          i++;
        }
        break;
      }
      case '--data': {
        const val = args[i + 1];
        if (val) {
          dataDir = val;
          i++;
        }
        break;
      }
      case 'uninstall':
        command = 'uninstall';
        break;
    }
  }

  return { port, dataDir, command };
}

async function main() {
  const { port, dataDir, command } = parseArgs(process.argv.slice(2));

  if (command === 'uninstall') {
    await unregisterService();
    logger.info('服务已卸载');
    return;
  }

  setDataDir(dataDir);

  const app = new App();
  await app.initialize();

  await registerService(dataDir);
  const server = await startServer(port);

  // Graceful shutdown
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`收到 ${signal}，正在优雅关闭...`);

    // Flush pending Git commits
    try {
      await app.git.flush();
    } catch (err) {
      logger.error(`Git flush 失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Close HTTP server (stop accepting new connections)
    server.close(() => {
      logger.info('HTTP 服务器已关闭');
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error('优雅关闭超时，强制退出');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(`启动失败: ${err}`);
  process.exit(1);
});