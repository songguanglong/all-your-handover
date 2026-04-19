import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../utils/data-dir';

export interface PreviousHandover {
  id: string;
  date: string;
  body: string;
}

const DEFAULT_CONTEXT_LABEL = '未知';

function handoversDir(channelCode: string): string {
  return path.join(getDataDir(), `channels/${channelCode}/handovers`);
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n*/);
  return match ? content.slice(match[0].length) : content;
}

function extractIdFromFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?id:\s*(hv_\S+)/m);
  return match ? match[1] : '';
}

function extractDateFromFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?completed_at:\s*(\S+)/m);
  if (match) return match[1];
  const created = content.match(/^---\n[\s\S]*?created_at:\s*(\S+)/m);
  return created ? created[1] : '';
}

export async function getLatestHandover(channelCode: string): Promise<PreviousHandover | null> {
  const dir = handoversDir(channelCode);
  let months: string[];
  try {
    months = (await fs.readdir(dir)).sort().reverse();
  } catch {
    return null;
  }

  for (const month of months) {
    const monthDir = path.join(dir, month);
    let stat;
    try {
      stat = await fs.stat(monthDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let files: string[];
    try {
      files = (await fs.readdir(monthDir))
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse();
    } catch {
      continue;
    }

    if (files.length === 0) continue;

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(monthDir, file), 'utf-8');
        const body = stripFrontmatter(content).trim();
        if (!body) continue;

        const id = extractIdFromFrontmatter(content);
        const date = extractDateFromFrontmatter(content);
        return { id, date, body };
      } catch {
        continue;
      }
    }
  }

  return null;
}