#!/usr/bin/env node
/**
 * 打包 Windows 发布 ZIP。
 *
 * 前置条件：
 *   1. release-temp/ 已就位（包含 node.exe / node_modules / .env.win / package.json / package-lock.json）。
 *      这个目录是开发者首次手工准备的，后续打包脚本只复用它。
 *   2. 已运行 `npm run build` 生成最新 dist/。
 *
 * 输出：
 *   - all-your-handover-v<version>-win.zip （ZIP 内带顶层目录 all-your-handover/）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const version = pkg.version;

const stagingRoot = path.join(projectRoot, 'release-build');
const stagingDir = path.join(stagingRoot, 'all-your-handover');
const outputZip = path.join(projectRoot, `all-your-handover-v${version}-win.zip`);

const sources = {
  'node.exe': 'release-temp/node.exe',
  'package.json': 'package.json',
  'package-lock.json': 'release-temp/package-lock.json',
  '.env.win': 'release-temp/.env.win',
  'start.bat': 'start.bat',
  'dist': 'dist',
  'node_modules': 'release-temp/node_modules',
};

for (const src of Object.values(sources)) {
  const abs = path.join(projectRoot, src);
  if (!fs.existsSync(abs)) {
    console.error(`[ERROR] 缺少源文件: ${src}`);
    if (src.startsWith('release-temp/')) {
      console.error('        请先手工准备 release-temp/（首次需自备 node.exe 与生产依赖 node_modules）');
    } else if (src === 'dist') {
      console.error('        请先运行 npm run build');
    }
    process.exit(1);
  }
}

console.log('[INFO] 清理 staging 目录...');
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

console.log('[INFO] 复制内容到 staging...');
for (const [target, src] of Object.entries(sources)) {
  const from = path.join(projectRoot, src);
  const to = path.join(stagingDir, target);
  fs.cpSync(from, to, { recursive: true });
  console.log(`  + ${target}`);
}

console.log(`[INFO] 打包 ZIP（顶层目录: all-your-handover/）...`);
fs.rmSync(outputZip, { force: true });
const psCmd = [
  '$ProgressPreference=\'SilentlyContinue\';',
  `Compress-Archive -Path '${stagingDir.replace(/'/g, "''")}' -DestinationPath '${outputZip.replace(/'/g, "''")}' -Force`,
].join(' ');
execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { stdio: 'inherit' });

console.log('[INFO] 清理 staging...');
fs.rmSync(stagingRoot, { recursive: true, force: true });

const stats = fs.statSync(outputZip);
console.log(`[OK] 打包完成: ${path.basename(outputZip)} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
