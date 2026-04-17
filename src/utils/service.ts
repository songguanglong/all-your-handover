import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-./\\:]+$/;

export async function registerService(dataDir?: string): Promise<void> {
  if (dataDir && !SAFE_PATH_RE.test(dataDir)) {
    throw new Error(`Invalid data directory path: ${dataDir}`);
  }

  const platform = os.platform();
  const execPath = process.execPath;
  const scriptPath = `${process.cwd()}/dist/index.js`;
  const dataFlag = dataDir ? ` --data ${dataDir}` : '';

  if (platform === 'linux') {
    try {
      const serviceContent = `[Unit]
Description=All Your Handover
After=network.target

[Service]
Type=simple
ExecStart=${execPath} ${scriptPath}${dataFlag}
Restart=on-failure
Environment=NODE_ENV=production
WorkingDirectory=${process.cwd()}

[Install]
WantedBy=multi-user.target`;
      // Write unit file directly instead of piping through shell
      const unitPath = '/etc/systemd/system/all-your-handover.service';
      const tmpPath = path.join(os.tmpdir(), 'all-your-handover.service');
      await fs.writeFile(tmpPath, serviceContent);
      await execAsync(`sudo cp ${tmpPath} ${unitPath} && sudo chmod 644 ${unitPath}`);
      await fs.unlink(tmpPath).catch(() => {});
      await execAsync('sudo systemctl daemon-reload && sudo systemctl enable all-your-handover');
    } catch {
      console.log('跳过 systemd 注册（需 sudo 权限），以前台模式运行');
    }
  } else if (platform === 'win32') {
    console.log('Windows 服务注册需管理员权限，请以管理员身份运行或使用前台模式');
  }
}

export async function unregisterService(): Promise<void> {
  const platform = os.platform();
  if (platform === 'linux') {
    try {
      await execAsync('sudo systemctl stop all-your-handover && sudo systemctl disable all-your-handover');
      await execAsync('sudo rm -f /etc/systemd/system/all-your-handover.service');
      await execAsync('sudo systemctl daemon-reload');
    } catch {
      console.log('跳过 systemd 卸载（需 sudo 权限）');
    }
  }
}