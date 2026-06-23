import { afterEach, describe, expect, it, vi } from 'vitest';
import { BANNER_EVENTS_KEY } from '../../src/content';

const invokeMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe('getBannerEventsForStats', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
    invokeMock.mockReset();
  });

  it('falls back to local events when server returns an empty array', async () => {
    vi.stubEnv('VITE_ADMIN_ACTION_SECRET', 'test-admin-action-secret');
    localStorage.setItem(
      BANNER_EVENTS_KEY,
      JSON.stringify([
        {
          type: 'impression',
          label: 'Winner Spotlight',
          redirectUrl: 'https://www.viralrefer.app/#prize',
          key: 'Winner Spotlight|https://www.viralrefer.app/#prize',
          timestamp: '2026-06-22T12:00:00Z',
        },
      ]),
    );
    invokeMock.mockResolvedValue({ data: { success: true, data: [] }, error: null });

    const { getBannerEventsForStats } = await import('../../src/content');
    const res = await getBannerEventsForStats();

    expect(res.source).toBe('local');
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Winner Spotlight');
    expect(res.fetchError).toContain('Server has no banner events');
  });

  it('prefers server events when server has rows', async () => {
    vi.stubEnv('VITE_ADMIN_ACTION_SECRET', 'test-admin-action-secret');
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([{ type: 'click', label: 'Local only' }]));
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            event_type: 'impression',
            banner_label: 'Server Banner',
            redirect_url: 'https://example.com',
            additional: { key: 'Server Banner|https://example.com' },
            created_at: '2026-06-22T13:00:00Z',
          },
        ],
      },
      error: null,
    });

    const { getBannerEventsForStats } = await import('../../src/content');
    const res = await getBannerEventsForStats();

    expect(res.source).toBe('server');
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Server Banner');
  });
});