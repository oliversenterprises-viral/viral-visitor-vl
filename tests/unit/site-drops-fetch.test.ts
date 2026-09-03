import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SITE_DROPS,
  SITE_DROPS_FETCH_TIMEOUT_MS,
  fetchPublicSiteDropsWithTimeout,
} from '../../src/lib/site-drops-fetch';

const root = resolve(import.meta.dirname, '../..');

describe('site-drops ladder fail-fast', () => {
  it('caps every ladder fetch at 2s', () => {
    expect(SITE_DROPS_FETCH_TIMEOUT_MS).toBe(2_000);
  });

  it('returns empty ladder JSON when the request never settles', async () => {
    const started = Date.now();
    const result = await fetchPublicSiteDropsWithTimeout(() => new Promise(() => {}), 40);
    expect(result.timedOut).toBe(true);
    expect(result.raw).toEqual(EMPTY_SITE_DROPS);
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('returns live payload when the request wins the race', async () => {
    const live = { drops: [{ kind: 'entered' }], pending_entered: [] };
    const result = await fetchPublicSiteDropsWithTimeout(async () => live, 200);
    expect(result.timedOut).toBe(false);
    expect(result.raw).toEqual(live);
  });

  it('aborts the in-flight signal on timeout', async () => {
    let aborted = false;
    await fetchPublicSiteDropsWithTimeout((signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise(() => {});
    }, 30);
    expect(aborted).toBe(true);
  });

  it('keeps LIMIT 1 and a 2s statement timeout on the public RPC', () => {
    const sql = readFileSync(resolve(root, 'supabase/migrations/0055_public_site_drops.sql'), 'utf8');
    expect(sql).toContain('get_public_site_drops');
    expect(sql).toMatch(/SET statement_timeout = '2s'/);
    expect(sql).toMatch(/LIMIT 1/);
    expect(sql).toContain("WHERE sc.key = 'site_drops'");
    expect(sql).toContain('sc.value::text');
  });

  it('store load is LIMIT 1 so it cannot scan site_content', () => {
    const store = readFileSync(
      resolve(root, 'supabase/functions/_shared/site-drops-store.ts'),
      'utf8',
    );
    expect(store).toMatch(/\.eq\('key', SITE_DROPS_KEY\)\s*\.limit\(1\)\s*\.maybeSingle\(\)/);
  });

  it('initApp kicks the ladder off without waiting on site_content', () => {
    const app = readFileSync(resolve(root, 'src/app.ts'), 'utf8');
    expect(app).toContain('loadSiteDropsLadder');
    expect(app).toMatch(/void import\('\.\/lib\/site-drops-ui'\)/);
    const idxLadder = app.indexOf('loadSiteDropsLadder');
    const idxContent = app.indexOf('await withInitTimeout(loadSiteContent()');
    expect(idxLadder).toBeGreaterThan(0);
    expect(idxContent).toBeGreaterThan(idxLadder);
    expect(app).toContain('const INIT_FETCH_TIMEOUT_MS = 12_000');
  });
});
