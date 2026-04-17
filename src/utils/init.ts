import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from './data-dir';

export async function initDirectories(): Promise<void> {
  const dataDir = getDataDir();
  const dirs = [
    path.join(dataDir, 'config'),
    path.join(dataDir, 'channels'),
    path.join(dataDir, 'logs'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 检测首次运行
  const configExists = await fs.access(path.join(dataDir, 'config/channels.json'))
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    // 首次运行，创建默认配置
    await fs.writeFile(
      path.join(dataDir, 'config/channels.json'),
      JSON.stringify({ platforms: {}, channels: [] }, null, 2)
    );
    await fs.writeFile(
      path.join(dataDir, 'config/llm-providers.json'),
      JSON.stringify({ providers: [], defaultProviderId: null }, null, 2)
    );
  }
}