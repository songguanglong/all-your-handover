import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from './data-dir';

function getLogFile(): string {
  return path.join(getDataDir(), 'logs/app.log');
}

let logStream: fs.FileHandle | null = null;

async function ensureLogDir(): Promise<void> {
  await fs.mkdir(path.dirname(getLogFile()), { recursive: true });
}

async function writeToFile(line: string): Promise<void> {
  try {
    await ensureLogDir();
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
};