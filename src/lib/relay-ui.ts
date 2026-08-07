/**
 * ViralRefer Relay — full-page Hot Seat UI.
 */

import {
  fetchRelayStateRpc,
  getOrCreateRelayClientKey,
  normalizeRelayUrlInput,
  relayAction,
  type RelayPublicState,
  type RelaySession,
} from './relay-client';
import { DEFAULT_REFERRAL_BASE_URL } from '../config';

const DEFAULT_HOUSE =
  'https://www.viralrefer.app/?ref=RELAY&utm_source=relay&utm_medium=hotseat&utm_campaign=house';
const DEFAULT_BANNER =
  'https://www.viralrefer.app/?ref=RELAY&utm_source=relay&utm_medium=banner&utm_campaign=house';
const GET_LINK =
  'https://www.viralrefer.app/?utm_source=relay&utm_medium=cta&utm_campaign=get_link#get-link';

type UiState = {
  public: RelayPublicState | null;
  credits: number;
  phase: 'idle' | 'viewing' | 'ready' | 'done';
  dwellLeft: number;
  opened: boolean;
  openedAt: number | null;
  message: string;
  error: string;
  lastEnqueueShare: string;
};

const ui: UiState = {
  public: null,
  credits: 0,
  phase: 'idle',
  dwellLeft: 15,
  opened: false,
  openedAt: null,
  message: '',
  error: '',
  lastEnqueueShare: '',
};

let timerId: number | null = null;
let tickId: number | null = null;

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function minDwell(): number {
  return ui.public?.min_dwell_seconds ?? 15;
}

function liveUrl(): string {
  return ui.public?.live?.url || ui.public?.house_url || DEFAULT_HOUSE;
}

function liveDomain(): string {
  return ui.public?.live?.domain || 'viralrefer.app';
}

function isHouse(): boolean {
  return Boolean(ui.public?.live?.is_house) || !ui.public?.live?.id;
}

function bannerUrl(): string {
  return ui.public?.banner_url || DEFAULT_BANNER;
}

function applyRelayDocumentMeta(): void {
  document.documentElement.setAttribute('data-vr-relay', '1');
  document.documentElement.style.colorScheme = 'dark';
  document.title = 'ViralRefer Relay • Free reciprocal traffic exchange';

  const ensureMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
    let node = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attr, name);
      document.head.appendChild(node);
    }
    node.content = content;
  };

  ensureMeta('theme-color', '#6b3acc');
  ensureMeta(
    'description',
    'ViralRefer Relay is a free reciprocal traffic exchange. View the LIVE site, earn 1 credit, queue your website so the next visitors see it. Fair Hot Seat — not paid ads.',
  );
  ensureMeta('og:title', 'ViralRefer Relay • Free reciprocal traffic exchange', 'property');
  ensureMeta(
    'og:description',
    'Free reciprocal traffic exchange: you view their site, they view yours. Earn a credit → queue your URL → go LIVE.',
    'property',
  );
  ensureMeta('og:url', `${DEFAULT_REFERRAL_BASE_URL}/relay`, 'property');
  ensureMeta('twitter:title', 'ViralRefer Relay • Free reciprocal traffic exchange');
  ensureMeta(
    'twitter:description',
    'Free reciprocal traffic exchange: view LIVE → earn a credit → queue your site.',
  );

  const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (viewport) {
    viewport.content =
      'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5';
  }

  try {
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', `${DEFAULT_REFERRAL_BASE_URL}/relay`);
  } catch {
    /* ignore */
  }
}

function defaultShareBlurb(): string {
  return (
    `I’m on ViralRefer Relay — a free reciprocal traffic exchange. ` +
    `You view the LIVE site, earn a credit, then queue yours so the next visitors see your site: ` +
    `${DEFAULT_REFERRAL_BASE_URL}/relay`
  );
}

function renderShell(): void {
  applyRelayDocumentMeta();

  const root = document.createElement('div');
  root.id = 'vr-relay-root';
  root.className = 'vr-relay-root';
  root.innerHTML = `
    <a class="vr-relay-banner" id="vr-relay-banner" href="${escapeHtml(bannerUrl())}" target="_blank" rel="noopener noreferrer">
      <span class="vr-relay-banner-badge">Also</span>
      <span class="vr-relay-banner-copy">
        <span class="vr-relay-banner-text vr-relay-banner-text--short"><strong>Referral board</strong> · free link ~30s</span>
        <span class="vr-relay-banner-text vr-relay-banner-text--long"><strong>Separate product:</strong> free referral leaderboard · get a link in ~30s</span>
      </span>
      <span class="vr-relay-banner-cta">Open <span aria-hidden="true">↗</span></span>
    </a>

    <main class="vr-relay-main" id="vr-relay-main">
      <header class="vr-relay-header">
        <div class="vr-relay-header-text">
          <p class="vr-relay-kicker">
            <span class="vr-relay-kicker-product">ViralRefer Relay</span>
            <span class="vr-relay-product-badge" aria-label="Product type">Free reciprocal traffic exchange</span>
          </p>
          <h1 class="vr-relay-title">You view their site.<br class="vr-relay-br-sm" /> They view yours.</h1>
          <p class="vr-relay-sub">
            This page is a <strong>free reciprocal traffic exchange</strong> (Hot Seat).
            Open the LIVE site → wait ${minDwell()}s → earn <strong>1 credit</strong> → spend it to put <strong>your</strong> URL in the queue.
            When you’re LIVE, the next people open <em>your</em> site. Not paid ads. Not guaranteed sales.
          </p>
        </div>
        <a class="vr-relay-home-link" href="${DEFAULT_REFERRAL_BASE_URL}/?utm_source=relay&utm_medium=nav&utm_campaign=home">← Main site</a>
      </header>

      <p class="vr-relay-promise" role="note">
        <span><strong>Give</strong> a real view</span>
        <span class="vr-relay-promise-sep" aria-hidden="true">→</span>
        <span><strong>Earn</strong> 1 credit</span>
        <span class="vr-relay-promise-sep" aria-hidden="true">→</span>
        <span><strong>Get</strong> views back</span>
      </p>

      <ol class="vr-relay-steps" aria-label="How this reciprocal exchange works">
        <li><span class="vr-relay-step-n">1</span> Open LIVE site</li>
        <li><span class="vr-relay-step-n">2</span> Earn 1 credit</li>
        <li><span class="vr-relay-step-n">3</span> Queue your site</li>
      </ol>

      <section class="vr-relay-card vr-relay-live" aria-labelledby="vr-relay-live-heading">
        <div class="vr-relay-live-top">
          <h2 id="vr-relay-live-heading"><span class="vr-relay-live-icon" aria-hidden="true">🔥</span> LIVE NOW</h2>
          <span class="vr-relay-pill" id="vr-relay-live-pill">loading…</span>
        </div>
        <p class="vr-relay-live-intro">Exchange Hot Seat — open this site to earn your credit</p>
        <p class="vr-relay-domain" id="vr-relay-domain">—</p>
        <p class="vr-relay-live-label" id="vr-relay-live-label" hidden></p>
        <p class="vr-relay-meta" id="vr-relay-meta"></p>
        <div class="vr-relay-actions">
          <button type="button" class="vr-relay-btn vr-relay-btn-primary" id="vr-relay-open">Open LIVE site</button>
          <div class="vr-relay-timer" id="vr-relay-timer" aria-live="polite">Open the LIVE site, then wait ${minDwell()}s</div>
        </div>
        <button type="button" class="vr-relay-btn vr-relay-btn-secondary" id="vr-relay-confirm" disabled>
          I visited — claim 1 credit
        </button>
      </section>

      <section class="vr-relay-card" aria-labelledby="vr-relay-queue-heading">
        <h2 id="vr-relay-queue-heading">Join the exchange — put YOUR site LIVE</h2>
        <p class="vr-relay-queue-lead">Spend 1 credit (earned by viewing others) to enter the fair queue. When you hit the Hot Seat, the next visitors open <strong>your</strong> website.</p>
        <div class="vr-relay-stats" aria-live="polite">
          <div class="vr-relay-stat"><span class="vr-relay-stat-label">Your credits</span><strong id="vr-relay-credits">0</strong></div>
          <div class="vr-relay-stat"><span class="vr-relay-stat-label">In queue</span><strong id="vr-relay-queue-len">0</strong></div>
        </div>
        <label class="vr-relay-label" for="vr-relay-url">Your website URL</label>
        <input class="vr-relay-input" id="vr-relay-url" type="url" inputmode="url" enterkeyhint="go" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://yoursite.com" />
        <button type="button" class="vr-relay-btn vr-relay-btn-primary" id="vr-relay-enqueue" disabled>
          Spend 1 credit · join queue
        </button>
        <p class="vr-relay-hint">Fair reciprocal rule: 1 real view = 1 credit. 1 credit = your Hot Seat for a set number of visitor views. No purchase required.</p>
      </section>

      <section class="vr-relay-card vr-relay-success" id="vr-relay-success" hidden>
        <h2>You’re in the exchange 🎉</h2>
        <p id="vr-relay-success-msg"></p>
        <p class="vr-relay-success-hint">Share Relay so more people view LIVE — that keeps the reciprocal queue moving.</p>
        <div class="vr-relay-dual">
          <button type="button" class="vr-relay-btn vr-relay-btn-primary" id="vr-relay-copy-share">Copy Relay share blurb</button>
          <a class="vr-relay-btn vr-relay-btn-secondary" id="vr-relay-get-link" href="${GET_LINK}">Optional: free referral link</a>
        </div>
      </section>

      <p class="vr-relay-status" id="vr-relay-status" role="status"></p>
      <p class="vr-relay-error" id="vr-relay-error" role="alert" hidden></p>

      <section class="vr-relay-card vr-relay-feed" aria-labelledby="vr-relay-feed-heading">
        <h2 id="vr-relay-feed-heading">Exchange activity</h2>
        <ul class="vr-relay-feed-list" id="vr-relay-feed-list"><li>Loading…</li></ul>
      </section>

      <footer class="vr-relay-footer">
        <p><strong>Reciprocal exchange:</strong> Open LIVE → wait ${minDwell()}s → claim 1 credit → paste your URL → when you’re LIVE, the next people open <em>your</em> site. Credits in = views out. Fair Hot Seat, not ads.</p>
        <p>White-hat only. Malware, phishing, and abuse are blocked. Separate from the main referral leaderboard. <a href="${DEFAULT_REFERRAL_BASE_URL}/">viralrefer.app</a></p>
      </footer>
    </main>
  `;

  document.body.prepend(root);
}

function paint(): void {
  const live = ui.public?.live;
  const domainEl = el<HTMLElement>('vr-relay-domain');
  const pill = el<HTMLElement>('vr-relay-live-pill');
  const meta = el<HTMLElement>('vr-relay-meta');
  const credits = el<HTMLElement>('vr-relay-credits');
  const qlen = el<HTMLElement>('vr-relay-queue-len');
  const confirm = el<HTMLButtonElement>('vr-relay-confirm');
  const enqueue = el<HTMLButtonElement>('vr-relay-enqueue');
  const timer = el<HTMLElement>('vr-relay-timer');
  const status = el<HTMLElement>('vr-relay-status');
  const err = el<HTMLElement>('vr-relay-error');
  const banner = el<HTMLAnchorElement>('vr-relay-banner');
  const feed = el<HTMLElement>('vr-relay-feed-list');

  const liveLabel = el<HTMLElement>('vr-relay-live-label');
  if (domainEl) {
    // Prefer short domain for any screen width (avoids mid-word wraps of long labels)
    domainEl.textContent = liveDomain();
  }
  if (liveLabel) {
    if (isHouse() && (live?.label || ui.public?.house_label)) {
      liveLabel.hidden = false;
      liveLabel.textContent = live?.label || ui.public?.house_label || '';
    } else {
      liveLabel.hidden = true;
      liveLabel.textContent = '';
    }
  }
  if (pill) {
    if (!ui.public?.enabled && ui.public) {
      pill.textContent = 'paused';
      pill.dataset.kind = 'paused';
    } else if (isHouse()) {
      pill.textContent = 'house';
      pill.dataset.kind = 'house';
    } else {
      pill.textContent = 'user';
      pill.dataset.kind = 'user';
    }
  }
  if (meta) {
    if (live && !live.is_house && live.views_remaining != null) {
      meta.textContent = `${live.views_remaining} views left · ${live.views_delivered} delivered`;
    } else if (isHouse()) {
      meta.textContent = 'Queue empty — house seat until someone joins the exchange';
    } else {
      meta.textContent = '';
    }
  }
  if (credits) credits.textContent = String(ui.credits);
  if (qlen) qlen.textContent = String(ui.public?.queue_length ?? 0);

  if (timer) {
    if (!ui.opened) {
      timer.textContent = `Open the LIVE site, then wait ${minDwell()}s`;
    } else if (ui.dwellLeft > 0) {
      timer.textContent = `Keep going… ${ui.dwellLeft}s remaining`;
    } else {
      timer.textContent = 'Ready — claim your credit';
    }
  }

  if (confirm) {
    confirm.disabled = !(ui.opened && ui.dwellLeft <= 0 && ui.phase !== 'done');
  }
  if (enqueue) {
    enqueue.disabled = ui.credits < 1;
  }
  if (status) status.textContent = ui.message;
  if (err) {
    if (ui.error) {
      err.hidden = false;
      err.textContent = ui.error;
    } else {
      err.hidden = true;
      err.textContent = '';
    }
  }
  if (banner) banner.href = bannerUrl();

  if (feed) {
    const recent = ui.public?.recent || [];
    if (!recent.length) {
      feed.innerHTML =
        '<li class="vr-relay-muted">No exchange activity yet — view LIVE, then be first in the queue.</li>';
    } else {
      feed.innerHTML = recent
        .map((r) => {
          const st = escapeHtml(r.status);
          const d = escapeHtml(r.domain);
          return `<li><span class="vr-relay-feed-status" data-st="${st}">${st}</span> ${d}</li>`;
        })
        .join('');
    }
  }
}

function stopTimers(): void {
  if (timerId != null) {
    window.clearTimeout(timerId);
    timerId = null;
  }
  if (tickId != null) {
    window.clearInterval(tickId);
    tickId = null;
  }
}

function startDwell(): void {
  stopTimers();
  ui.opened = true;
  ui.openedAt = Date.now();
  ui.phase = 'viewing';
  ui.dwellLeft = minDwell();
  ui.error = '';
  ui.message = 'Site opened — stay for the full timer to earn 1 exchange credit.';
  paint();

  tickId = window.setInterval(() => {
    if (!ui.openedAt) return;
    const elapsed = (Date.now() - ui.openedAt) / 1000;
    ui.dwellLeft = Math.max(0, Math.ceil(minDwell() - elapsed));
    if (ui.dwellLeft <= 0) {
      ui.phase = 'ready';
      if (tickId != null) {
        window.clearInterval(tickId);
        tickId = null;
      }
    }
    paint();
  }, 250);
}

async function refreshState(): Promise<void> {
  getOrCreateRelayClientKey();
  const res = await relayAction('state');
  if (res.success && res.state) {
    ui.public = res.state as RelayPublicState;
  } else {
    const rpc = await fetchRelayStateRpc();
    if (rpc) ui.public = rpc;
  }
  const session = res.session as RelaySession | undefined;
  if (session && typeof session.credits === 'number') {
    ui.credits = session.credits;
  }
  paint();
}

async function onConfirmView(): Promise<void> {
  if (!ui.openedAt || ui.dwellLeft > 0) return;
  const dwell_ms = Date.now() - ui.openedAt;
  ui.message = 'Recording view…';
  ui.error = '';
  paint();

  const res = await relayAction('view', {
    dwell_ms,
    focused: document.visibilityState === 'visible',
  });

  if (!res.success) {
    ui.error = String(res.error || 'Could not credit view');
    ui.message = '';
    paint();
    return;
  }

  if (typeof res.credits === 'number') ui.credits = res.credits as number;
  if (res.state) ui.public = res.state as RelayPublicState;
  ui.message = String(res.message || 'Credit earned! Paste your URL below to join the exchange queue.');
  ui.phase = 'idle';
  ui.opened = false;
  ui.openedAt = null;
  ui.dwellLeft = minDwell();
  paint();
}

async function onEnqueue(): Promise<void> {
  const input = el<HTMLInputElement>('vr-relay-url');
  const url = normalizeRelayUrlInput(input?.value || '');
  if (!url) {
    ui.error = 'Paste your website URL first';
    paint();
    return;
  }

  ui.message = 'Joining queue…';
  ui.error = '';
  paint();

  const res = await relayAction('enqueue', { url });
  if (!res.success) {
    ui.error = String(res.error || 'Could not enqueue');
    ui.message = '';
    if (typeof res.credits === 'number') ui.credits = res.credits as number;
    paint();
    return;
  }

  if (typeof res.credits === 'number') ui.credits = res.credits as number;
  if (res.state) ui.public = res.state as RelayPublicState;
  ui.message = String(res.message || 'Queued!');
  ui.phase = 'done';

  const success = el<HTMLElement>('vr-relay-success');
  const successMsg = el<HTMLElement>('vr-relay-success-msg');
  if (success) success.hidden = false;
  if (successMsg) {
    successMsg.textContent = String(
      res.message || 'You’re in the reciprocal queue — keep the exchange moving by sharing Relay.',
    );
  }

  const house = res.house_cta as { share_hint?: string; get_link_url?: string } | undefined;
  ui.lastEnqueueShare = house?.share_hint || defaultShareBlurb();

  const getLink = el<HTMLAnchorElement>('vr-relay-get-link');
  if (getLink && house?.get_link_url) getLink.href = house.get_link_url;

  if (input) input.value = '';
  paint();
}

function bind(): void {
  el<HTMLButtonElement>('vr-relay-open')?.addEventListener('click', () => {
    const url = liveUrl();
    // Prefer same-tab on tiny devices if popup blocked — still try blank first for multi-tasking
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked: open via temporary anchor (still starts dwell)
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
    startDwell();
  });

  el<HTMLButtonElement>('vr-relay-confirm')?.addEventListener('click', () => {
    void onConfirmView();
  });

  el<HTMLButtonElement>('vr-relay-enqueue')?.addEventListener('click', () => {
    void onEnqueue();
  });

  el<HTMLInputElement>('vr-relay-url')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      void onEnqueue();
    }
  });

  el<HTMLButtonElement>('vr-relay-copy-share')?.addEventListener('click', async () => {
    const text = ui.lastEnqueueShare || defaultShareBlurb();
    try {
      await navigator.clipboard.writeText(text);
      ui.message = 'Relay share blurb copied — paste it where website owners hang out';
      paint();
    } catch {
      ui.error = 'Could not copy — long-press select the text instead';
      paint();
    }
  });

  // Soft refresh state periodically
  window.setInterval(() => {
    void refreshState();
  }, 45_000);

  // Re-paint on orientation / visual viewport changes (keyboard open on mobile)
  window.addEventListener(
    'resize',
    () => {
      /* layout is CSS-driven; keep class for future hooks */
      document.documentElement.dataset.vrRelayOrient =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    },
    { passive: true },
  );
  document.documentElement.dataset.vrRelayOrient =
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * Bootstrap Relay full page. Call only when isRelayMode().
 */
export async function initRelayUi(): Promise<void> {
  getOrCreateRelayClientKey();
  renderShell();
  bind();
  ui.message = 'Loading reciprocal exchange…';
  paint();
  await refreshState();
  if (!ui.public) {
    ui.error = 'Relay is warming up — refresh in a moment.';
    ui.message = '';
  } else if (ui.public.enabled === false) {
    ui.error = 'Relay exchange is temporarily paused.';
  } else {
    ui.message = 'Reciprocal exchange ready — open LIVE to earn your first credit.';
  }
  paint();
}
