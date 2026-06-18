import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { loadChannelsConfig, loadLLMProvidersConfig } from '../services/config-service';
import { getApp } from '../app';
import { logger } from '../utils/logger';
import { getVersion } from '../utils/version';

import { getDataDir } from '../utils/data-dir';
import { sanitizeError } from './sanitize-error';

export function registerMonitoringRoutes(router: import('express').Router, prefix: string): void {
  // System status
  router.get(`${prefix}/status`, async (_req: Request, res: Response) => {
    try {
      const channelsConfig = await loadChannelsConfig();
      const llmConfig = await loadLLMProvidersConfig();

      const firstRun = channelsConfig.channels.length === 0 && llmConfig.providers.length === 0;

      res.json({
        code: 0,
        data: {
          status: 'ok',
          uptime: process.uptime(),
          version: getVersion(),
          firstRun,
          channelCount: channelsConfig.channels.filter(ch => ch.isEnabled).length,
          providerCount: llmConfig.providers.filter(p => p.isEnabled).length,
          hasDefaultProvider: llmConfig.defaultProviderId != null,
        },
      });
    } catch (err) {
      logger.error(`Status error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // LLM queue status
  router.get(`${prefix}/llm-queue`, (_req: Request, res: Response) => {
    try {
      const app = getApp();
      const status = app ? app.llmQueue.getStatus() : { totalPending: 0, activeCalls: 0, byChannel: {} };
      res.json({ code: 0, data: status });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Logs
  router.get(`${prefix}/logs`, async (req: Request, res: Response) => {
    try {
      const lines = Math.min(parseInt(String(req.query.lines || '100'), 10), 1000);
      const logPath = path.join(getDataDir(), 'logs/app.log');
      let content = '';
      try {
        content = await fs.readFile(logPath, 'utf-8');
      } catch {
        content = '';
      }
      const allLines = content.split('\n').filter(Boolean);
      const recent = allLines.slice(-lines);
      res.json({ code: 0, data: { lines: recent, total: allLines.length } });
    } catch (err) {
      logger.error(`Logs error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}