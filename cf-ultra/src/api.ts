import { demoJoin, demoMe, demoSimulate } from './demo';
import type { BoardState, HealthOk, JoinOk, MeOk } from './types';

export type Transport = 'live' | 'demo';

let transport: Transport = 'demo';
let healthNote = 'Starting in local demo until /api/health answers.';
let degraded = false;

export function isDegraded(): boolean {
  return degraded;
}

export function currentTransport(): Transport {
  return transport;
}

export function currentHealthNote(): string {
  return healthNote;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const data = (await res.json()) as T & { error?: string; ok?: boolean };
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function probeHealth(): Promise<HealthOk | null> {
  try {
    const data = await getJson<HealthOk>('/api/health');
    transport = 'live';
    healthNote = data.scale
      ? `${data.note} Target ${data.scale.target} on ${data.scale.assumedPlan}.`
      : data.note;
    return data;
  } catch {
    transport = 'demo';
    healthNote = 'Functions not reachable — client demo mode (localStorage). TODO: wrangler pages dev --kv BOARD';
    return null;
  }
}

export async function fetchBoard(): Promise<BoardState> {
  if (transport === 'demo') return demoMe().board;
  const res = await fetch('/api/board', { headers: { accept: 'application/json' } });
  degraded = res.headers.get('x-ultra-degraded') === '1' || res.status === 429;
  if (res.status === 429) throw new Error('Board busy — backing off');
  const data = (await res.json()) as { ok?: boolean; board?: BoardState; error?: string; degraded?: boolean };
  if (!res.ok || data.ok === false || !data.board) throw new Error(data.error || 'Board failed');
  if (data.degraded) degraded = true;
  return data.board;
}

export async function fetchMe(): Promise<MeOk> {
  if (transport === 'demo') return demoMe();
  return getJson<MeOk>('/api/me');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function joinSite(url: string, ref?: string | null): Promise<JoinOk> {
  if (transport === 'demo') return demoJoin(url, ref);
  let last = new Error('Could not get your link. Try again.');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, ref: ref || undefined }),
      });
      const data = (await res.json()) as JoinOk & { error?: string };
      if (res.ok && data.ok) return data;
      last = new Error(data.error || 'Join failed');
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw last;
    } catch (err) {
      last = err instanceof Error ? err : last;
      if (err instanceof Error && /Paste a real|Could not read|Missing actor|paused by the owner/.test(err.message)) {
        throw err;
      }
    }
    await sleep(350 * (attempt + 1));
  }
  throw last;
}

export async function simulateFriend(code: string): Promise<JoinOk> {
  if (transport === 'demo') return demoSimulate(code);
  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json()) as JoinOk & { error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || 'Simulate failed');
  return data;
}

export async function fetchEmbed(site: string): Promise<{ iframe: string; script: string }> {
  if (transport === 'demo') {
    const origin = location.origin;
    const host = site.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return {
      iframe: `<iframe src="${origin}/e/${encodeURIComponent(host)}" title="Help us go viral" style="width:100%;max-width:420px;height:88px;border:0;border-radius:16px"></iframe>`,
      script: `<script async src="${origin}/embed.js" data-site="${host}"></script>`,
    };
  }
  return getJson<{ iframe: string; script: string }>(`/api/embed?site=${encodeURIComponent(site)}`);
}
