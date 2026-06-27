import { describe, expect, it } from 'vitest';
import {
  countTestBannerEvents,
  filterTestBannerEvents,
  isAutomationUserAgent,
  isTestBannerEvent,
} from '../../supabase/functions/_shared/admin-stats-test';

describe('admin-stats-test', () => {
  it('flags owner and headless banner rows', () => {
    expect(
      isTestBannerEvent({
        ip: '161.38.136.60',
        user_agent: 'Mozilla/5.0 Chrome',
        event_type: 'impression',
      }),
    ).toBe(true);
    expect(
      isTestBannerEvent({
        ip: '8.8.8.8',
        user_agent: 'Mozilla/5.0 HeadlessChrome/149',
        event_type: 'impression',
      }),
    ).toBe(true);
    expect(
      isTestBannerEvent({
        ip: '103.25.136.249',
        user_agent: 'Mozilla/5.0 Chrome',
        event_type: 'impression',
      }),
    ).toBe(false);
  });

  it('filters test banner events for admin display', () => {
    const events = [
      { ip: '161.38.136.60', user_agent: 'Chrome' },
      { ip: '1.2.3.4', user_agent: 'Safari' },
    ];
    expect(countTestBannerEvents(events)).toBe(1);
    expect(filterTestBannerEvents(events)).toHaveLength(1);
  });

  it('isAutomationUserAgent matches smoke tooling only', () => {
    expect(isAutomationUserAgent('node')).toBe(true);
    expect(isAutomationUserAgent('Mozilla/5.0 HeadlessChrome')).toBe(true);
    expect(isAutomationUserAgent('Mozilla/5.0 Chrome')).toBe(false);
  });
});