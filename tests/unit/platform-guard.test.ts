import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluatePlatformGuard,
  parsePlatformGuardSnapshot,
  platformGuardCopyIsDeskSafe,
  shouldDropNoiseWrites,
  shouldSkipRealtimeSockets,
  rememberPublicPlatformGuard,
  emptyPlatformGuardSnapshot,
  PLATFORM_DISK_LIMIT_BYTES,
  PLATFORM_EDGE_LIMIT_MONTH,
} from '../../src/lib/platform-guard';
import { renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';

const root = resolve(import.meta.dirname, '../..');

describe('platform guard', () => {
  it('stays ok on an empty snapshot', () => {
    const view = evaluatePlatformGuard(emptyPlatformGuardSnapshot());
    expect(view.severity).toBe('ok');
    expect(view.dropNoise).toBe(false);
    expect(view.skipRealtime).toBe(false);
    expect(platformGuardCopyIsDeskSafe(view)).toBe(true);
    expect(view.title).not.toMatch(/Funnel|Friends|Prize|Website|Promoters|Referrals/i);
  });

  it('pauses noise writes near the disk freeze line', () => {
    const view = evaluatePlatformGuard({
      diskBytes: PLATFORM_DISK_LIMIT_BYTES * 0.86,
      diskLimitBytes: PLATFORM_DISK_LIMIT_BYTES,
      visitorEventRows: 90000,
      interactionEventRows: 40000,
      edgeInvokesMonth: 1000,
      edgeLimit: PLATFORM_EDGE_LIMIT_MONTH,
      dbActivity: 8,
      dropNoise: false,
      skipRealtime: false,
    });
    expect(view.severity).toBe('hole');
    expect(view.dropNoise).toBe(true);
    expect(view.meters.find((m) => m.id === 'disk')?.status).toBe('hole');
    expect(view.detail).toMatch(/Clear junk visits/);
    expect(platformGuardCopyIsDeskSafe(view)).toBe(true);
  });

  it('pauses live sockets when the small computer is busy', () => {
    const view = evaluatePlatformGuard({
      diskBytes: 10_000_000,
      diskLimitBytes: PLATFORM_DISK_LIMIT_BYTES,
      visitorEventRows: 10,
      interactionEventRows: 10,
      edgeInvokesMonth: 10,
      edgeLimit: PLATFORM_EDGE_LIMIT_MONTH,
      dbActivity: 48,
      dropNoise: false,
      skipRealtime: false,
    });
    expect(view.meters.find((m) => m.id === 'compute')?.status).toBe('hole');
    expect(view.skipRealtime).toBe(true);
    expect(view.dropNoise).toBe(true);
  });

  it('pauses click writes near the monthly Edge cap', () => {
    const view = evaluatePlatformGuard({
      diskBytes: 10_000_000,
      diskLimitBytes: PLATFORM_DISK_LIMIT_BYTES,
      visitorEventRows: 10,
      interactionEventRows: 10,
      edgeInvokesMonth: 440_000,
      edgeLimit: PLATFORM_EDGE_LIMIT_MONTH,
      dbActivity: 4,
      dropNoise: false,
      skipRealtime: false,
    });
    expect(view.meters.find((m) => m.id === 'edge')?.status).toBe('hole');
    expect(view.dropNoise).toBe(true);
    expect(view.detail).toMatch(/Get-link, Send, and credit stay/);
  });

  it('honors cached flags for client skip helpers', () => {
    rememberPublicPlatformGuard(
      parsePlatformGuardSnapshot({
        dropNoise: true,
        skipRealtime: true,
        diskBytes: 1,
        diskLimitBytes: PLATFORM_DISK_LIMIT_BYTES,
        edgeInvokesMonth: 1,
        edgeLimit: PLATFORM_EDGE_LIMIT_MONTH,
        dbActivity: 1,
      }),
    );
    expect(shouldDropNoiseWrites()).toBe(true);
    expect(shouldSkipRealtimeSockets()).toBe(true);
  });

  it('paints Guard on the desk without a seventh tile', () => {
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(
      el,
      {
        windowDays: 7,
        visits: 0,
        friendLandings: 0,
        landings: 0,
        getLink: 0,
        share: 0,
        locked: 0,
        getLinkRate: '0%',
        feed: [],
      },
      undefined,
      emptyPlatformGuardSnapshot(),
    );
    expect(el.querySelector('[data-hq-platform-guard]')).not.toBeNull();
    expect(el.querySelectorAll('[data-hq-guard-meter]').length).toBe(4);
    expect(el.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(6);
    expect(el.textContent).toMatch(/Guard/);
    expect(el.textContent).not.toMatch(/Prize|Website|Promoters|What.?s happening now|More numbers/i);
  });

  it('keeps SQL from deleting credits', () => {
    const sql = readFileSync(resolve(root, 'supabase/migrations/0057_platform_guard.sql'), 'utf8');
    expect(sql).toContain('refresh_platform_guard_state');
    expect(sql).toContain('get_platform_guard_public');
    expect(sql).toMatch(/DELETE FROM public\.interaction_events/);
    expect(sql).not.toMatch(/DELETE FROM public\.referrals/i);
    expect(sql).not.toMatch(/DELETE FROM public\.shares/i);
    expect(sql).not.toMatch(/DELETE FROM public\.referrer_links/i);
    const action = readFileSync(resolve(root, 'supabase/functions/admin-action/index.ts'), 'utf8');
    expect(action).toContain("action === 'get_platform_guard'");
    const interaction = readFileSync(
      resolve(root, 'supabase/functions/record-interaction/index.ts'),
      'utf8',
    );
    expect(interaction).toContain('bumpPlatformGuardInvoke');
    const clientTrack = readFileSync(resolve(root, 'src/lib/interaction-tracking.ts'), 'utf8');
    expect(clientTrack).toContain('shouldDropNoiseWrites');
    const app = readFileSync(resolve(root, 'src/app.ts'), 'utf8');
    expect(app).toContain('shouldSkipRealtimeSockets');
    expect(app).toContain('visibilitychange');
  });
});
