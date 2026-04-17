import { App, getApp } from './app';
import { startServer } from './server';
import { logger } from './utils/logger';
import { registerService, unregisterService } from './utils/service';

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

  process.env.DATA_DIR = dataDir;

  const app = new App();
  await app.initialize();

  await registerService(dataDir);
  await startServer(port);
}

main().catch((err) => {
  logger.error(`启动失败: ${err}`);
  process.exit(1);
});