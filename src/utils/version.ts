import path from 'path';
import fs from 'fs';

let cachedVersion: string | null = null;

/**
 * 读取并缓存项目版本号（来自 package.json）。
 * 编译后 dist/utils/version.js -> ../../package.json
 * 开发模式 src/utils/version.ts -> ../../package.json
 */
export function getVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    cachedVersion = String(pkg.version || '0.0.0');
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}
