import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function registerService(): Promise<void> {
  const platform = os.platform();

  if (platform === 'linux') {
    // 尝试注册 systemd 服务（需 sudo）
    try {
      const serviceContent = `[Unit]
Description=All Your Handover
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${process.cwd()}/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target`;
      await execAsync(`echo '${serviceContent}' | sudo tee /etc/systemd/system/all-your-handover.service`);
      await execAsync('sudo systemctl daemon-reload && sudo systemctl enable all-your-handover');
    } catch {
      console.log('跳过 systemd 注册（需 sudo 权限），以前台模式运行');
    }
  } else if (platform === 'win32') {
    // Windows 服务注册（需管理员权限）
    console.log('Windows 服务注册需管理员权限，请以管理员身份运行或使用前台模式');
  }
}