import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDataDir } from './data-dir';

const execAsync = promisify(exec);
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-./\\:]+$/;
const SERVICE_NAME = 'AllYourHandover';

async function findNssm(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'nssm.exe'),
    'nssm.exe',
  ];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return null;
}

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
    try {
      const nssmPath = await findNssm();
      if (!nssmPath) {
        console.log('nssm.exe 未找到，请下载后放入 scripts/ 目录或加入 PATH');
        console.log('下载地址: https://nssm.cc/download');
        return;
      }

      const runScript = path.join(process.cwd(), 'scripts', 'run-with-env.bat');
      const logDir = path.join(getDataDir(), 'logs');

      await execAsync(`"${nssmPath}" install ${SERVICE_NAME} "${runScript}"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} AppDirectory "${process.cwd()}"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} DisplayName "All Your Handover"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} Description "交接班助手 - 轻量级本地部署"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} Start SERVICE_AUTO_START`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} AppStdout "${path.join(logDir, 'service-stdout.log')}"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} AppStderr "${path.join(logDir, 'service-stderr.log')}"`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} AppRotateFiles 1`);
      await execAsync(`"${nssmPath}" set ${SERVICE_NAME} AppRotateBytes 10485760`);
      await execAsync(`"${nssmPath}" start ${SERVICE_NAME}`);

      console.log('Windows 服务已注册并启动 (AllYourHandover)');
    } catch {
      console.log('跳过 Windows 服务注册（需管理员权限），以前台模式运行');
    }
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
  } else if (platform === 'win32') {
    try {
      const nssmPath = await findNssm();
      if (!nssmPath) {
        console.log('nssm.exe 未找到，无法卸载 Windows 服务');
        return;
      }
      await execAsync(`"${nssmPath}" stop ${SERVICE_NAME}`).catch(() => {});
      await execAsync(`"${nssmPath}" remove ${SERVICE_NAME} confirm`);
      console.log('Windows 服务已卸载');
    } catch {
      console.log('跳过 Windows 服务卸载（需管理员权限）');
    }
  }
}