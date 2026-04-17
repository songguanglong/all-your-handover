import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

export async function initDirectories(): Promise<void> {
  const dirs = [
    path.join(DATA_DIR, 'config'),
    path.join(DATA_DIR, 'channels'),
    path.join(DATA_DIR, 'logs'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 检测首次运行
  const configExists = await fs.access(path.join(DATA_DIR, 'config/channels.json'))
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    // 首次运行，创建默认配置
    await fs.writeFile(
      path.join(DATA_DIR, 'config/channels.json'),
      JSON.stringify({ platforms: {}, channels: [] }, null, 2)
    );
    await fs.writeFile(
      path.join(DATA_DIR, 'config/llm-providers.json'),
      JSON.stringify({ providers: [], defaultProviderId: null }, null, 2)
    );
  }
}