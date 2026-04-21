import { logger } from '../utils/logger';

export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    logger.error(`API error: ${err.message}`);
  }
  return 'Internal error';
}