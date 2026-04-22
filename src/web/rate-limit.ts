import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10_000;

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function rateLimit(windowMs: number = DEFAULT_WINDOW_MS, maxRequests: number = DEFAULT_MAX_REQUESTS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    cleanup();
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      if (store.size >= MAX_STORE_SIZE) {
        // Evict oldest entry to bound memory
        let oldestKey = '';
        let oldestAt = Infinity;
        for (const [k, e] of store) {
          if (e.resetAt < oldestAt) { oldestAt = e.resetAt; oldestKey = k; }
        }
        if (oldestKey) store.delete(oldestKey);
      }
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      return next();
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}: ${entry.count} requests in window`);
      res.status(429).json({ code: -1, message: '请求过于频繁，请稍后再试' });
      return;
    }

    next();
  };
}
