import { describe, expect, it } from 'vitest';
import {
  fetchLeaderboard,
  fetchSiteContent,
  fetchTotalReferrers,
  isSupabaseConfigured,
} from '../../src/lib/supabase';

describe('supabase configuration', () => {
  it('exports isSupabaseConfigured boolean', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean');
  });

  it('fetch helpers return safe empty defaults when unconfigured', async () => {
    if (isSupabaseConfigured) return;
    await expect(fetchLeaderboard()).resolves.toEqual([]);
    await expect(fetchTotalReferrers()).resolves.toBe(0);
    await expect(fetchSiteContent()).resolves.toEqual({});
  });
});