import { describe, expect, it } from 'vitest';
import {
  AUTOPILOT_CRON_PATH,
  AUTOPILOT_CRON_SCHEDULE,
  formatAutopilotCronLabel,
  isCronBearerAuthorized,
} from '../../src/lib/autopilot-schedule';

describe('autopilot-schedule', () => {
  it('exposes cron path and schedule', () => {
    expect(AUTOPILOT_CRON_PATH).toBe('/api/cron-optimizer');
    expect(AUTOPILOT_CRON_SCHEDULE).toBe('0 6 * * *');
    expect(formatAutopilotCronLabel()).toMatch(/06:00 UTC/);
  });

  it('isCronBearerAuthorized validates bearer token', () => {
    expect(isCronBearerAuthorized('Bearer secret123', 'secret123')).toBe(true);
    expect(isCronBearerAuthorized('Bearer wrong', 'secret123')).toBe(false);
    expect(isCronBearerAuthorized(null, 'secret123')).toBe(false);
    expect(isCronBearerAuthorized('Bearer x', '')).toBe(false);
  });
});