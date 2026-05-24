/**
 * Safe error formatting helper.
 *
 * Converts any thrown value into a human-readable string without using `any`.
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Unknown error');
  }
  return 'Unknown error';
}
