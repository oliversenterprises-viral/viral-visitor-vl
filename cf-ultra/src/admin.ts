import './styles.css';
import './admin.css';

type Dash = {
  ok: boolean;
  range: string;
  kv: boolean;
  liveVisitors: number;
  window: Record<string, number> & { platforms?: Record<string, number> };
  today: Record<string, number>;
  all: Record<string, number>;
  series: { day: string; lands: number; joins: number; shares: number; credits: number; pageviews: number; uniques: number }[];
  funnel: Record<string, number>;
  platforms: { key: string; n: number }[];
  referrers: { key: string; n: number }[];
  utm: { key: string; n: number }[];
  geo: { key: string; n: number }[];
  device: { key: string; n: number }[];
  browser: { key: string; n: number }[];
  feed: { at: number; text: string; kind: string; country?: string }[];
  rungs: { at: number; host: string; rung: string }[];
  board: { banner?: { label: string }; entered: unknown[]; rising: unknown[]; challenger: unknown[] };
  topSharers: { code: string; host: string; credits: number; streak: number }[];
  topSites: { host: string; credits: number; owner: string }[];
  ops: { bannedCodes: string[]; bannedSites: string[]; mutedCodes: string[]; hero: string; lead: string };
  health: { kv: boolean; degraded: boolean; cache: string; players: number; sites: number; credits: number; writePolicy: string; assumedPlan: string };
};

const root = document.querySelector<HTMLElement>('#hq')!;
let range = '7d';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bars(rows: { key: string; n: number }[], cls = ''): string {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return `<p class="note">No events in this window yet — numbers stay honest.</p>`;
  return `<div class="bars">${rows
    .map((r) => `<div class="bar ${cls}"><span>${esc(r.key)}</span><i style="width:${Math.round((r.n / max) * 100)}%"></i><span>${r.n}</span></div>`)
    .join('')}</div>`;
}

function spark(series: Dash['series']): string {
  if (!series.length) return '';
  const max = Math.max(1, ...series.map((s) => s.credits + s.joins + s.uniques));
  const w = 560;
  const h = 80;
  const step = w / Math.max(1, series.length - 1);
  const pts = series.map((s, i) => `${i * step},${h - ((s.credits + s.joins) / max) * (h - 6)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="80" aria-hidden="true"><polyline fill="none" stroke="#d6ff3e" stroke-width="3" points="${pts}"/></svg>`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { accept: 'application/json', ...(init?.headers || {}) } });
  const data = (await res.json()) as T & { error?: string; ok?: boolean };
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function loginView(note = ''): void {
  root.innerHTML = `
    <section class="lane login">
      <p class="kicker">OWNER HQ</p>
      <h1>Sign in on the edge</h1>
      <p class="note">Password is checked by a Pages Function (HMAC cookie). It is <strong>never</strong> a <code>VITE_</code> variable. Cloudflare Access email headers also pass.</p>
      ${note ? `<p class="note" style="color:var(--hot)">${esc(note)}</p>` : ''}
      <form data-login>
        <label class="note">Owner password</label>
        <input type="password" name="password" autocomplete="current-password" required />
        <button class="btn volt" type="submit">Enter HQ</button>
      </form>
      <p class="note">Local wrangler without <code>ADMIN_OWNER_PASSWORD</code> and without CF-Ray: <code>ultra-local-only</code>. Production on the edge requires a dashboard secret.</p>
    </section>`;
  root.querySelector('form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = new FormData(e.target as HTMLFormElement).get('password') as string;
    try {
      await api('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      await paint();
    } catch (err) {
      loginView(err instanceof Error ? err.message : 'Login failed');
    }
  });
}

function render(d: Dash): void {
  const w = d.window || {};
  const f = d.funnel || {};
  root.innerHTML = `
    <header class="hq-top">
      <div>
        <div class="word">ViralRefer <span>Ultra</span> · HQ</div>
        <p class="tag">LIVE COUNTERS · NO FAKE MRR · ${d.kv ? 'KV BOUND' : 'ISOLATE DEMO'}</p>
      </div>
      <div class="pills">
        <span class="pill live"><span class="live-dot"></span>${d.liveVisitors} live</span>
        <a class="pill" href="/">Public site</a>
        <button class="pill" data-out type="button">Log out</button>
      </div>
    </header>
    <h1>Every visitor. Every rung.</h1>
    <p class="note">Key conversions (paste, join, share, friend land, credit) flush immediately. Pageviews are sampled (~1/5) and buffered so KV write quotas survive thousands of daily visitors.</p>
    <div class="ranges">
      ${['today', '7d', '30d', 'all'].map((r) => `<button class="btn ghost" type="button" data-range="${r}" aria-pressed="${r === range}">${r}</button>`).join('')}
    </div>
    <div class="kpis">
      <div class="kpi"><b>${w.uniques ?? 0}</b><small>Unique visitors (${range})</small></div>
      <div class="kpi"><b>${w.sessions ?? 0}</b><small>Sessions</small></div>
      <div class="kpi"><b>${w.pageviews ?? 0}</b><small>Pageviews (sampled+lands)</small></div>
      <div class="kpi"><b>${w.credits ?? 0}</b><small>Unique friend credits</small></div>
      <div class="kpi"><b>${w.joins ?? 0}</b><small>Get my link</small></div>
      <div class="kpi"><b>${w.shares ?? 0}</b><small>Share clicks</small></div>
      <div class="kpi"><b>${f.shareToCredit ?? 0}%</b><small>Share → credit</small></div>
      <div class="kpi"><b>${f.bounce ?? 0}%</b><small>Bounce / no-join</small></div>
    </div>
    <div class="lane">${spark(d.series)}<p class="note">Joins + credits over ${esc(range)}</p></div>
    <div class="hq-grid two">
      <section class="lane">
        <h3>Funnel</h3>
        <div class="sub">Land → paste → link → share → friend land → credit</div>
        <div class="funnel">
          ${[
            ['Land', w.lands ?? 0],
            ['Paste site', w.pastes ?? 0],
            ['Get my link', w.joins ?? 0],
            ['Share click', w.shares ?? 0],
            ['Friend land', w.friendLands ?? 0],
            ['Credit', w.credits ?? 0],
          ].map(([l, n]) => `<div class="step"><span>${l}</span><strong>${n}</strong></div>`).join('')}
        </div>
        <p class="note">Drop-off: land→paste ${f.landToPaste}% · paste→join ${f.pasteToJoin}% · share→credit ${f.shareToCredit}%</p>
      </section>
      <section class="lane">
        <h3>Share platforms</h3>
        ${bars(d.platforms, '')}
        <h3>UTM / source</h3>
        ${bars(d.utm, 'ice')}
      </section>
    </div>
    <div class="hq-grid two">
      <section class="lane"><h3>Referrers</h3>${bars(d.referrers)}</section>
      <section class="lane"><h3>Geo (CF-ipcountry)</h3>${bars(d.geo, 'hot')}<p class="note">XX = country header missing (local preview).</p></section>
    </div>
    <div class="hq-grid two">
      <section class="lane"><h3>Device</h3>${bars(d.device)}</section>
      <section class="lane"><h3>Browser</h3>${bars(d.browser, 'ice')}</section>
    </div>
    <div class="hq-grid two">
      <section class="lane">
        <h3>Viral · top sharers</h3>
        <table class="hq-table"><thead><tr><th>Code</th><th>Site</th><th>Credits</th><th>Streak</th></tr></thead>
        <tbody>${d.topSharers.length ? d.topSharers.map((s) => `<tr><td>${esc(s.code)}</td><td>${esc(s.host)}</td><td>${s.credits}</td><td>${s.streak}</td></tr>`).join('') : '<tr><td colspan="4">No sharers yet.</td></tr>'}</tbody></table>
      </section>
      <section class="lane">
        <h3>Sites climbing</h3>
        <table class="hq-table"><thead><tr><th>Host</th><th>Locks</th><th>Owner</th></tr></thead>
        <tbody>${d.topSites.length ? d.topSites.map((s) => `<tr><td>${esc(s.host)}</td><td>${s.credits}</td><td>${esc(s.owner)}</td></tr>`).join('') : '<tr><td colspan="3">Empty board.</td></tr>'}</tbody></table>
        <p class="note">Banner now: ${esc(d.board?.banner?.label || 'open')} · entered ${d.board?.entered?.length ?? 0} · rising ${d.board?.rising?.length ?? 0} · challenger ${d.board?.challenger?.length ?? 0}</p>
      </section>
    </div>
    <div class="hq-grid two">
      <section class="lane">
        <h3>Rung timeline</h3>
        <ol class="activity">${d.rungs.length ? d.rungs.map((r) => `<li><span>${esc(r.host)} → ${esc(r.rung)}</span><span>${new Date(r.at).toLocaleString()}</span></li>`).join('') : '<li><span>No rung unlocks yet.</span></li>'}</ol>
      </section>
      <section class="lane">
        <h3>Abuse flags</h3>
        <div class="kpis" style="grid-template-columns:1fr 1fr">
          <div class="kpi"><b>${w.selfRef ?? 0}</b><small>Self-ref ignored</small></div>
          <div class="kpi"><b>${w.burstIp ?? 0}</b><small>Burst IP / 429</small></div>
          <div class="kpi"><b>${w.blockedCredits ?? 0}</b><small>Blocked / banned</small></div>
          <div class="kpi"><b>${w.embedLoads ?? 0}</b><small>Embed loads</small></div>
        </div>
        <p class="note">Embed clicks: ${w.embedClicks ?? 0}. Errors: ${w.errors ?? 0}.</p>
      </section>
    </div>
    <section class="lane">
      <h3>Live event feed</h3>
      <ol class="activity">${d.feed.length ? d.feed.map((e) => `<li><span>${esc(e.text)}${e.country ? ` · ${esc(e.country)}` : ''}</span><span>${new Date(e.at).toLocaleTimeString()}</span></li>`).join('') : '<li>Waiting on real events.</li>'}</ol>
    </section>
    <section class="lane">
      <h3>Ops</h3>
      <p class="note">Ban/mute is live. Copy edits hit <code>/api/content</code> (cached ~15s). Reset demo wipes board + rollups.</p>
      <div class="ops-row">
        <input data-code placeholder="VR-XXXXXX" />
        <button class="btn hot" data-op="ban_code" type="button">Ban code</button>
        <button class="btn ghost" data-op="mute_code" type="button">Mute</button>
        <button class="btn ghost" data-op="unban" type="button">Unban</button>
      </div>
      <div class="ops-row">
        <input data-site placeholder="example.com" />
        <button class="btn hot" data-op="ban_site" type="button">Ban site</button>
        <button class="btn ghost" data-op="unban_site" type="button">Unban site</button>
      </div>
      <p class="note">Banned codes: ${d.ops.bannedCodes.join(', ') || 'none'} · sites: ${d.ops.bannedSites.join(', ') || 'none'} · muted: ${d.ops.mutedCodes.join(', ') || 'none'}</p>
      <div class="ops-row">
        <textarea data-hero rows="2">${esc(d.ops.hero)}</textarea>
        <textarea data-lead rows="2">${esc(d.ops.lead)}</textarea>
        <button class="btn volt" data-op="save_copy" type="button">Save copy</button>
      </div>
      <div class="ops-row">
        <button class="btn ghost" data-export="daily" type="button">CSV daily</button>
        <button class="btn ghost" data-export="funnel" type="button">CSV funnel</button>
        <button class="btn ghost" data-export="sites" type="button">CSV sites</button>
        <button class="btn ghost" data-export="sharers" type="button">CSV sharers</button>
        <button class="btn hot" data-op="reset_demo" type="button">Reset demo data</button>
      </div>
    </section>
    <section class="lane">
      <h3>Quota / KV health</h3>
      <p class="note">${esc(d.health.assumedPlan)}. Cache: ${esc(d.health.cache)}. Degraded: ${d.health.degraded ? 'yes' : 'no'}. Players ${d.health.players} · sites ${d.health.sites} · credit keys ${d.health.credits}.</p>
      <p class="note">${esc(d.health.writePolicy)}</p>
    </section>`;

  root.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      range = (btn as HTMLElement).dataset.range || '7d';
      void paint();
    });
  });
  root.querySelector('[data-out]')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    loginView();
  });
  root.querySelectorAll('[data-op]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const op = (btn as HTMLElement).dataset.op!;
      if (op === 'reset_demo' && !confirm('Wipe board + analytics rollups?')) return;
      const body: Record<string, string> = { op };
      body.code = (root.querySelector('[data-code]') as HTMLInputElement)?.value || '';
      body.site = (root.querySelector('[data-site]') as HTMLInputElement)?.value || '';
      body.hero = (root.querySelector('[data-hero]') as HTMLTextAreaElement)?.value || '';
      body.lead = (root.querySelector('[data-lead]') as HTMLTextAreaElement)?.value || '';
      await api('/api/admin/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      await paint();
    });
  });
  root.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = (btn as HTMLElement).dataset.export;
      location.href = `/api/admin/export?table=${table}&range=${range}`;
    });
  });
}

async function paint(): Promise<void> {
  const session = await fetch('/api/admin/session').then((r) => r.json());
  if (!session.ok) {
    loginView(session.localFallback ? 'Local fallback password: ultra-local-only' : '');
    return;
  }
  try {
    const dash = await api<Dash>(`/api/admin/dashboard?range=${range}`);
    render(dash);
  } catch (err) {
    loginView(err instanceof Error ? err.message : 'Dashboard failed');
  }
}

void paint();
setInterval(() => {
  if (!document.hidden) void paint();
}, 12_000);
