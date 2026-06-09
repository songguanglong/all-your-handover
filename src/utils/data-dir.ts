let _dataDir: string | undefined;

export function setDataDir(dir: string): void {
  _dataDir = dir;
}

export function getDataDir(): string {
  return _dataDir || process.env.DATA_DIR || './data';
}