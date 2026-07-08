/**
 * Autopilot schedule metadata — Vercel Cron → /api/cron-optimizer → optimizer-cron edge.
 */

export const AUTOPILOT_CRON_PATH = '/api/cron-optimizer';

/** Daily 06:00 UTC — after US overnight traffic, before EU peak. */
export const AUTOPILOT_CRON_SCHEDULE = '0 6 * * *';

export function formatAutopilotCronLabel(): string {
  return 'Daily at 06:00 UTC (Vercel Cron)';
}

export function isCronBearerAuthorized(
  authorizationHeader: string | null | undefined,
  cronSecret: string,
): boolean {
  const secret = cronSecret.trim();
  if (!secret) return false;
  const header = (authorizationHeader || '').trim();
  return header === `Bearer ${secret}`;
}