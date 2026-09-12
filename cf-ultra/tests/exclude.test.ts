import { afterEach, describe, expect, it } from 'vitest';
import { HQ_COOKIE, issueSession } from '../functions/_lib/admin-auth';
import { isolateBucket, purgeFeedByIp, recordAnalytics, resetAnalytics } from '../functions/_lib/analytics';
import {
  addExcludeIp,
  isExcludedIp,
  loadExcludeIps,
  normalizeIp,
  removeExcludeIp,
  resetExcludeRuntime,
  saveExcludeIps,
  shouldSkipStats,
  statsIp,
} from '../functions/_lib/exclude';
import type { UltraEnv } from '../functions/_lib/store';

afterEach(async () => {
  resetExcludeRuntime();
  await resetAnalytics({});
});

const hints = {
  country: 'US',
  device: 'desktop' as const,
  browser: 'chrome',
  referrer: 'direct',
  utm: 'none',
};

type KvBag = {
  data: Map<string, string>;
  get: (key: string, type?: string) => Promise<unknown>;
  put: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (opts?: { prefix?: string; limit?: number; cursor?: string }) => Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
};

function mockKv(init: Record<string, string> = {}): KvBag {
  const data = new Map(Object.entries(init));
  return {
    data,
    async get(key: string, type?: string) {
      const v = data.get(key);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      data.set(key, value);
    },
    async delete(key: string) {
      data.delete(key);
    },
    async list(opts: { prefix?: string; limit?: number; cursor?: string } = {}) {
      const prefix = opts.prefix || '';
      const keys = [...data.keys()]
        .filter((k) => k.startsWith(prefix))
        .sort()
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

function req(headers: Record<string, string>, url = 'https://example.test/api/track'): Request {
  return new Request(url, { method: 'POST', headers });
}

describe('normalizeIp', () => {
  it('accepts IPv4 and strips leading zeros', () => {
    expect(normalizeIp('203.0.113.10')).toBe('203.0.113.10');
    expect(normalizeIp(' 01.2.003.4 ')).toBe('1.2.3.4');
  });

  it('rejects junk and out-of-range IPv4', () => {
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp('localhost')).toBeNull();
    expect(normalizeIp('999.1.1.1')).toBeNull();
    expect(normalizeIp('1.2.3')).toBeNull();
  });

  it('accepts compressed IPv6 and mapped IPv4', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
    expect(normalizeIp('::1')).toBe('::1');
    expect(normalizeIp('::ffff:192.0.2.8')).toBe('192.0.2.8');
  });
});

describe('statsIp', () => {
  it('prefers CF-Connecting-IP over a spoofed X-Forwarded-For', () => {
    expect(
      statsIp(
        req({
          'cf-connecting-ip': '198.51.100.20',
          'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        }),
      ),
    ).toBe('198.51.100.20');
  });

  it('uses the first X-Forwarded-For hop when CF-Connecting-IP is absent', () => {
    expect(statsIp(req({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }))).toBe('203.0.113.10');
  });
});

describe('exclude list + skip gate', () => {
  it('matches normalized IPs', () => {
    expect(isExcludedIp(['1.2.3.4'], '01.2.3.4')).toBe(true);
    expect(isExcludedIp(['1.2.3.4'], '1.2.3.5')).toBe(false);
  });

  it('persists IPs on BOARD KV and skips those clients', async () => {
    const kv = mockKv();
    const env = { BOARD: kv } as unknown as UltraEnv;
    const added = await addExcludeIp(env, '203.0.113.10');
    expect(added.added).toBe('203.0.113.10');
    resetExcludeRuntime();
    expect(await loadExcludeIps(env)).toEqual(['203.0.113.10']);

    const skip = await shouldSkipStats(env, req({ 'cf-connecting-ip': '203.0.113.10' }));
    expect(skip).toMatchObject({ skip: true, reason: 'ip', ip: '203.0.113.10' });

    const keep = await shouldSkipStats(env, req({ 'cf-connecting-ip': '198.51.100.1' }));
    expect(keep.skip).toBe(false);

    const removed = await removeExcludeIp(env, '203.0.113.10');
    expect(removed.removed).toBe('203.0.113.10');
    expect(await shouldSkipStats(env, req({ 'cf-connecting-ip': '203.0.113.10' }))).toMatchObject({ skip: false });
  });

  it('skips an authenticated Owner HQ HMAC cookie', async () => {
    const env: UltraEnv = { ADMIN_OWNER_PASSWORD: 'owner-secret-test' };
    const token = await issueSession(env, req({}));
    expect(token).toBeTruthy();
    const skip = await shouldSkipStats(env, req({ cookie: `${HQ_COOKIE}=${token}`, 'cf-connecting-ip': '198.51.100.9' }));
    expect(skip).toMatchObject({ skip: true, reason: 'owner' });
  });

  it('skips Cloudflare Access as an owner session', async () => {
    const skip = await shouldSkipStats({}, req({ 'cf-access-authenticated-user-email': 'owner@example.com' }));
    expect(skip).toMatchObject({ skip: true, reason: 'owner' });
  });
});

describe('recordAnalytics skip + reset + purge', () => {
  it('does not increment counters for excluded IPs or owner sessions', async () => {
    const kv = mockKv();
    const env = { BOARD: kv } as unknown as UltraEnv;
    await saveExcludeIps(env, ['203.0.113.10']);

    const skipped = await recordAnalytics(env, {
      kind: 'land',
      actorId: 'act_excluded',
      sessionId: 'sess_excluded',
      hints,
      request: req({ 'cf-connecting-ip': '203.0.113.10' }),
    });
    expect(skipped.skipped).toBe(true);
    expect(isolateBucket().lands).toBe(0);
    expect(isolateBucket().pageviews).toBe(0);

    const counted = await recordAnalytics(env, {
      kind: 'land',
      actorId: 'act_public',
      sessionId: 'sess_public',
      hints,
      request: req({ 'cf-connecting-ip': '198.51.100.1' }),
    });
    expect(counted.skipped).toBe(false);
    expect(isolateBucket().lands).toBe(1);
  });

  it('resetAnalytics deletes every stats:* key and leaves the live board', async () => {
    const kv = mockKv({
      'ultra:state': JSON.stringify({ players: { keep: true } }),
      'ultra:board': '{}',
      'ultra:exclude-ips': JSON.stringify({ ips: ['203.0.113.10'] }),
      'stats:all': JSON.stringify({ hour: 'all', lands: 99 }),
      'stats:feed': '[]',
      'stats:rungs': '[]',
      'stats:day:2026-09-12': '{}',
      'stats:hour:2026-09-12T15': '{}',
    });
    const env = { BOARD: kv } as unknown as UltraEnv;
    const result = await resetAnalytics(env);
    expect(result.deleted).toBe(5);
    expect(kv.data.has('ultra:state')).toBe(true);
    expect(kv.data.has('ultra:board')).toBe(true);
    expect(kv.data.has('ultra:exclude-ips')).toBe(true);
    expect([...kv.data.keys()].filter((k) => k.startsWith('stats:'))).toEqual([]);
  });

  it('purgeFeedByIp drops matching HQ feed rows', async () => {
    const kv = mockKv({
      'stats:feed': JSON.stringify([
        { id: 'a', at: 1, kind: 'land', text: 'Landed', ip: '203.0.113.10' },
        { id: 'b', at: 2, kind: 'land', text: 'Landed', ip: '198.51.100.1' },
      ]),
    });
    const env = { BOARD: kv } as unknown as UltraEnv;
    const n = await purgeFeedByIp(env, '203.0.113.10');
    expect(n).toBe(1);
    const left = JSON.parse(kv.data.get('stats:feed')!) as { ip: string }[];
    expect(left).toEqual([{ id: 'b', at: 2, kind: 'land', text: 'Landed', ip: '198.51.100.1' }]);
  });
});
