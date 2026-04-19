import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

import { getDataDir } from '../utils/data-dir';
import { sanitizeError } from './sanitize-error';

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, unknown> = {};
  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const [, key, value] = kv;
      result[key] = value;
    }
  }
  return result;
}

export function registerHandoverRoutes(router: import('express').Router, prefix: string): void {
  // Query handover records
  router.get(`${prefix}/handovers`, async (req: Request, res: Response) => {
    try {
      const { channelCode, startDate, endDate, keyword, page = '1', pageSize = '20' } = req.query;
      const dataDir = getDataDir();
      const records: Record<string, unknown>[] = [];

      let channelDirs: string[] = [];
      if (channelCode && typeof channelCode === 'string') {
        channelDirs = [path.join(dataDir, `channels/${channelCode}/handovers`)];
      } else {
        try {
          const channelsDir = path.join(dataDir, 'channels');
          const entries = await fs.readdir(channelsDir);
          for (const entry of entries) {
            const handoverDir = path.join(channelsDir, entry, 'handovers');
            try { await fs.access(handoverDir); channelDirs.push(handoverDir); } catch { /* skip */ }
          }
        } catch { /* no channels dir */ }
      }

      for (const channelDir of channelDirs) {
        try {
          const months = await fs.readdir(channelDir);
          for (const month of months) {
            const monthDir = path.join(channelDir, month);
            let stat;
            try { stat = await fs.stat(monthDir); } catch { continue; }
            if (!stat.isDirectory()) continue;

            // Filter by date range
            if (startDate && typeof startDate === 'string' && month < startDate.substring(0, 7)) continue;
            if (endDate && typeof endDate === 'string' && month > endDate.substring(0, 7)) continue;

            const files = await fs.readdir(monthDir);
            for (const file of files) {
              if (!file.endsWith('.md')) continue;
              const filePath = path.join(monthDir, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const meta = parseFrontmatter(content);

              // Filter by keyword
              if (keyword && typeof keyword === 'string' && !content.includes(keyword)) continue;

              records.push({ ...meta, _file: file, _month: month });
            }
          }
        } catch { /* skip unreadable dirs */ }
      }

      records.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

      const p = parseInt(String(page), 10) || 1;
      const ps = parseInt(String(pageSize), 10) || 20;
      const start = (p - 1) * ps;
      const paginated = records.slice(start, start + ps);

      res.json({ code: 0, data: { records: paginated, total: records.length, page: p, pageSize: ps } });
    } catch (err) {
      logger.error(`Query handovers error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Get handover detail
  router.get(`${prefix}/handovers/:channelCode/:month/:file`, async (req: Request, res: Response) => {
    try {
      const { channelCode, month, file } = req.params;
      // Sanitize: prevent path traversal
      if (!/^[a-zA-Z0-9_]+$/.test(String(channelCode)) || !/^\d{4}-\d{2}$/.test(String(month)) || !/\.md$/.test(String(file))) {
        return res.status(400).json({ code: -1, message: 'Invalid parameters' });
      }
      const filePath = path.join(getDataDir(), `channels/${channelCode}/handovers/${month}/${file}`);
      const content = await fs.readFile(filePath, 'utf-8');
      const meta = parseFrontmatter(content);
      const body = content.replace(/^---[\s\S]*?---\n*/, '');
      res.json({ code: 0, data: { meta, body } });
    } catch (err) {
      res.status(404).json({ code: -1, message: 'Record not found' });
    }
  });
}