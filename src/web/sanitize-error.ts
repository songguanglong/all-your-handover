export function sanitizeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal error';
}