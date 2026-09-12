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
  ops: { bannedCodes: string[]; bannedSites: string[]; mutedCodes: string[]; hero: string; lead: string; teCreditsCount?: boolean };
  camps: { key: string; n: number }[];
  te: { lands: number; joins: number; ignored: number; toJoin: number; quality: number; teCreditsCount: boolean };
  alerts: {
    events: Record<string, boolean>;
    digest: 'off' | 'hourly' | 'daily';
    quietHours: { enabled: boolean; startHour: number; endHour: number; tzOffsetMinutes: number };
    telegram?: boolean;
    telegramConfigured?: boolean;
    telegramTokenConfigured?: boolean;
    telegramChatMasked?: string;
    telegramOwnerHint?: string;
    webhookUrl: string;
    webhookFromEnv: boolean;
    webhookConfigured: boolean;
    emailConfigured: boolean;
    inbox: {
      id: string;
      at: string;
      kind: string;
      title: string;
      body: string;
      host?: string;
      count: number;
      adminPath: string;
      delivered: string;
    }[];
  };
  health: { kv: boolean; degraded: boolean; cache: string; players: number; sites: number; credits: number; writePolicy: string; assumedPlan: string };
};

const ALERT_LABELS: Record<string, string> = {
  race_started: 'New site / race started',
  first_share: 'First share click for a site',
  friend_land: 'Friend land via referral (batched)',
  credit: 'Get my link / verified credit (1st–3rd instant)',
  rung_rising: 'Rising unlocked',
  rung_challenger: 'Challenger',
  rung_banner: '#1 banner claim',
  spike: 'Spike / abuse flags (batched)',
  digest: 'Write digest into the inbox',
};

const root = document.querySelector<HTMLElement>('#hq')!;
let range = '7d';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function telegramStatus(a: Dash['alerts'] | undefined): string {
  const hint = a?.telegramOwnerHint || '1274269043';
  if (a?.telegramConfigured) {
    return `Telegram: configured · chat ${esc(a.telegramChatMasked || '…set')} (owner ${esc(hint)}). Test ping hits that chat.`;
  }
  const token = a?.telegramTokenConfigured ? 'token set' : 'token missing';
  const chat = a?.telegramChatMasked ? `chat ${esc(a.telegramChatMasked)}` : `chat default ${esc(hint)}`;
  return `Telegram: missing — ${token}, ${chat}. Inbox still records. Set Pages secret TELEGRAM_BOT_TOKEN. Owner chat id for this deploy is ${esc(hint)}.`;
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
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="80" aria-hidden="true"><polyline fill="none" stroke="#864cff" stroke-width="3" points="${pts}"/></svg>`;
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
      <p class="kicker">OWNER HQ · SITE DROPS</p>
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
        <div class="word"><span class="mark">V</span> ViralRefer <span class="badge">HQ</span></div>
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
        <div class="sub">Land → Paste site → Get my link → Share → Friend land → Credit</div>
        <div class="funnel">
          ${[
            ['Land', w.lands ?? 0],
            ['Paste site', w.pastes ?? 0],
            ['Get my link', w.joins ?? 0],
            ['Share', w.shares ?? 0],
            ['Friend land', w.friendLands ?? 0],
            ['Credit', w.credits ?? 0],
          ].map(([l, n]) => `<div class="step"><span>${l}</span><strong>${n}</strong></div>`).join('')}
        </div>
        <p class="note">Same names as FUNNEL.md. Drop-off: land→paste ${f.landToPaste}% · paste→join ${f.pasteToJoin}% · share→credit ${f.shareToCredit}%</p>
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
    <div class="hq-grid two" data-alerts>
      <section class="lane" id="alerts-inbox">
        <h3>Owner alerts inbox</h3>
        <p class="note">High-signal conversions only — not pageviews. Telegram is the default owner ping when secrets are set. Demo / missing secrets still log here. Bursts batch (e.g. “12 credits in 5m”).</p>
        <ol class="activity inbox">${
          (d.alerts?.inbox || []).length
            ? d.alerts.inbox
                .map((e) => {
                  const focus = new URLSearchParams(location.search).get('focus');
                  const focusHost = new URLSearchParams(location.search).get('host');
                  const on = (focus && e.kind === focus) || (focusHost && e.host === focusHost);
                  return `<li class="${on ? 'focus' : ''}"><span><strong>${esc(e.title)}</strong> · ${esc(e.body)}${e.host ? ` · ${esc(e.host)}` : ''} <small>${esc(e.delivered)}</small></span><a href="${esc(e.adminPath)}">${new Date(e.at).toLocaleString()}</a></li>`;
                })
                .join('')
            : '<li><span>No owner alerts yet. Paste a site or hit Test ping.</span></li>'
        }</ol>
      </section>
      <section class="lane">
        <h3>Notify me</h3>
        <p class="note">${telegramStatus(d.alerts)} Never put the bot token in the client or a <code>VITE_</code> var.</p>
        <label class="toggle"><input type="checkbox" data-telegram ${d.alerts?.telegram !== false ? 'checked' : ''}/> Telegram (primary owner channel)</label>
        <p class="note">Optional webhook / email still fire if configured. Email via Resend ${d.alerts?.emailConfigured ? '— configured' : '— not set'}.</p>
        <div class="toggles">
          ${Object.entries(ALERT_LABELS)
            .map(
              ([k, label]) =>
                `<label class="toggle"><input type="checkbox" data-alert-ev="${k}" ${d.alerts?.events?.[k] ? 'checked' : ''}/> ${esc(label)}</label>`,
            )
            .join('')}
        </div>
        <div class="ops-row">
          <label class="note">Digest</label>
          <select data-digest>
            ${['off', 'hourly', 'daily']
              .map((v) => `<option value="${v}" ${d.alerts?.digest === v ? 'selected' : ''}>${v}</option>`)
              .join('')}
          </select>
        </div>
        <div class="ops-row">
          <input data-webhook type="url" placeholder="https://discord.com/api/webhooks/… or Slack incoming" value="${esc(d.alerts?.webhookUrl || '')}" ${d.alerts?.webhookFromEnv ? 'disabled' : ''} />
        </div>
        <p class="note">${d.alerts?.webhookFromEnv ? 'Webhook URL is set as NOTIFY_WEBHOOK_URL (dashboard secret).' : d.alerts?.webhookConfigured ? 'Webhook saved (masked). Clear the field to remove.' : 'No webhook yet — inbox still records alerts.'}</p>
        <label class="toggle"><input type="checkbox" data-quiet ${d.alerts?.quietHours?.enabled ? 'checked' : ''}/> Quiet hours (UTC offset minutes)</label>
        <div class="ops-row">
          <input data-quiet-start type="number" min="0" max="23" title="Start hour" value="${d.alerts?.quietHours?.startHour ?? 22}" />
          <input data-quiet-end type="number" min="0" max="23" title="End hour" value="${d.alerts?.quietHours?.endHour ?? 8}" />
          <input data-quiet-tz type="number" min="-840" max="840" title="UTC offset minutes" value="${d.alerts?.quietHours?.tzOffsetMinutes ?? 0}" />
        </div>
        <div class="ops-row">
          <button class="btn volt" data-op="save_alerts" type="button">Save alert prefs</button>
          <button class="btn ghost" data-op="test_alert" type="button">Test ping</button>
        </div>
      </section>
    </div>
    <section class="lane">
      <h3>Traffic exchange</h3>
      <p class="note">Splash impressions on <code>/te</code> are not written (edge-cheap). These counts are people who opened through to Site Drops with <code>src=te</code>. TE Get-my-link does <strong>not</strong> count as a verified credit unless you flip the switch (default off — #1 banner stays honest).</p>
      <div class="kpis" style="grid-template-columns:1fr 1fr 1fr 1fr">
        <div class="kpi"><b>${d.te?.lands ?? 0}</b><small>TE visits</small></div>
        <div class="kpi"><b>${d.te?.joins ?? 0}</b><small>TE → Get my link</small></div>
        <div class="kpi"><b>${d.te?.toJoin ?? 0}%</b><small>TE conversion</small></div>
        <div class="kpi"><b>${d.te?.quality ?? 0}%</b><small>Credits / TE visit</small></div>
      </div>
      <p class="note">Credits ignored from TE: ${d.te?.ignored ?? 0}. Campaigns:</p>
      ${bars(d.camps || [])}
      <div class="ops-row">
        <input data-te-camp placeholder="campaign (optional)" />
        <button class="btn volt" type="button" data-te-copy>Copy TE destination</button>
        <button class="btn ghost" type="button" data-te-iframe>Copy iframe snippet</button>
      </div>
      <label class="toggle"><input type="checkbox" data-te-count ${d.te?.teCreditsCount || d.ops.teCreditsCount ? 'checked' : ''}/> Allow TE-attributed credits on the weekly race / #1 banner (not recommended)</label>
      <button class="btn ghost" data-op="save_te" type="button">Save TE integrity</button>
    </section>
    <section class="lane">
      <h3>Ops</h3>
      <p class="note">Ban/mute is live. Copy edits hit <code>/api/content</code> (cached ~15s). Reset demo wipes board + rollups.</p>
      <div class="ops-row">
        <input data-code placeholder="VIRAL-XXXXXXX" />
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
      const body: Record<string, unknown> = { op };
      body.code = (root.querySelector('[data-code]') as HTMLInputElement)?.value || '';
      body.site = (root.querySelector('[data-site]') as HTMLInputElement)?.value || '';
      body.hero = (root.querySelector('[data-hero]') as HTMLTextAreaElement)?.value || '';
      body.lead = (root.querySelector('[data-lead]') as HTMLTextAreaElement)?.value || '';
      if (op === 'save_te') {
        body.teCreditsCount = (root.querySelector('[data-te-count]') as HTMLInputElement)?.checked === true;
      }
      if (op === 'save_alerts' || op === 'test_alert') {
        const events: Record<string, boolean> = {};
        root.querySelectorAll<HTMLInputElement>('[data-alert-ev]').forEach((el) => {
          events[el.dataset.alertEv!] = el.checked;
        });
        body.events = events;
        body.digest = (root.querySelector('[data-digest]') as HTMLSelectElement)?.value || 'off';
        body.webhookUrl = (root.querySelector('[data-webhook]') as HTMLInputElement)?.value ?? '';
        body.telegram = (root.querySelector('[data-telegram]') as HTMLInputElement)?.checked !== false;
        body.quietHours = {
          enabled: (root.querySelector('[data-quiet]') as HTMLInputElement)?.checked === true,
          startHour: Number((root.querySelector('[data-quiet-start]') as HTMLInputElement)?.value || 22),
          endHour: Number((root.querySelector('[data-quiet-end]') as HTMLInputElement)?.value || 8),
          tzOffsetMinutes: Number((root.querySelector('[data-quiet-tz]') as HTMLInputElement)?.value || 0),
        };
      }
      await api('/api/admin/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      await paint();
    });
  });
  root.querySelector('[data-te-copy]')?.addEventListener('click', async () => {
    const camp = (root.querySelector('[data-te-camp]') as HTMLInputElement)?.value.trim() || 'hq';
    const url = `${location.origin}/te?src=te&camp=${encodeURIComponent(camp)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  });
  root.querySelector('[data-te-iframe]')?.addEventListener('click', async () => {
    const camp = (root.querySelector('[data-te-camp]') as HTMLInputElement)?.value.trim() || 'hq';
    const snip = `<iframe src="${location.origin}/te?src=te&camp=${encodeURIComponent(camp)}&size=468x60" width="468" height="60" style="border:0;overflow:hidden;max-width:100%" loading="lazy" title="ViralRefer Site Drops"></iframe>`;
    try {
      await navigator.clipboard.writeText(snip);
    } catch {
      /* ignore */
    }
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
  if (document.hidden) return;
  const box = root.querySelector('[data-alerts]');
  if (box && document.activeElement && box.contains(document.activeElement)) return;
  void paint();
}, 12_000);
