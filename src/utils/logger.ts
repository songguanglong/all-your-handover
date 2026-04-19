import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from './data-dir';

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;
const ROTATE_CHECK_INTERVAL = 100; // Check file size every N writes

function getLogDir(): string {
  return path.join(getDataDir(), 'logs');
}

function getLogFile(): string {
  return path.join(getLogDir(), 'app.log');
}

async function ensureLogDir(): Promise<void> {
  await fs.mkdir(getLogDir(), { recursive: true });
}

let writeCount = 0;

async function rotateIfNeeded(): Promise<void> {
  writeCount++;
  if (writeCount % ROTATE_CHECK_INTERVAL !== 1) return;

  try {
    const stats = await fs.stat(getLogFile()).catch(() => null);
    if (!stats || stats.size < MAX_LOG_SIZE) return;

    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldPath = path.join(getLogDir(), `app.log.${i}`);
      const newPath = path.join(getLogDir(), `app.log.${i + 1}`);
      try {
        await fs.rename(oldPath, newPath);
      } catch {
        // File doesn't exist, skip
      }
    }
    await fs.rename(getLogFile(), path.join(getLogDir(), 'app.log.1'));
  } catch {
    // Rotation failure must not crash the app
  }
}

async function writeToFile(line: string): Promise<void> {
  try {
    await ensureLogDir();
    await rotateIfNeeded();
    await fs.appendFile(getLogFile(), line + '\n');
  } catch {
    // Log file write failure must not crash the app
  }
}

function formatMessage(level: string, msg: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${msg}`;
}

export const logger = {
  info(msg: string): void {
    const line = formatMessage('INFO', msg);
    console.log(line);
    writeToFile(line).catch(() => {});
  },

  error(msg: string): void {
    const line = formatMessage('ERROR', msg);
    console.error(line);
    writeToFile(line).catch(() => {});
  },

  warn(msg: string): void {
    const line = formatMessage('WARN', msg);
    console.warn(line);
    writeToFile(line).catch(() => {});
  },

  debug(msg: string): void {
    const line = formatMessage('DEBUG', msg);
    console.log(line);
    writeToFile(line).catch(() => {});
  },
};