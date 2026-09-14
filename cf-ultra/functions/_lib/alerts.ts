import { shouldSkipStats } from './exclude';
import { kvBound, type UltraEnv } from './store';

export const ALERT_KINDS = [
  'race_started',
  'first_share',
  'friend_land',
  'credit',
  'rung_rising',
  'rung_challenger',
  'rung_banner',
  'spike',
  'digest',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export type AlertPrefs = {
  events: Record<AlertKind, boolean>;
  webhookUrl: string;
  /** Primary owner path. Secrets still required to actually send. */
  telegram: boolean;
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    tzOffsetMinutes: number;
  };
  digest: 'off' | 'hourly' | 'daily';
};

/** Documented owner chat for this ViralRefer Ultra deploy. Set TELEGRAM_CHAT_ID to this. Never a bot token. */
export const OWNER_TELEGRAM_CHAT_ID = '1274269043';

export const FUNNEL_STEP: Record<AlertKind, string> = {
  race_started: 'Paste site',
  first_share: 'Share',
  friend_land: 'Friend land',
  credit: 'Credit',
  rung_rising: 'Climb',
  rung_challenger: 'Climb',
  rung_banner: 'Climb',
  spike: 'Spike',
  digest: 'Digest',
};

export type InboxItem = {
  id: string;
  at: string;
  kind: AlertKind;
  title: string;
  body: string;
  host?: string;
  count: number;
  adminPath: string;
  delivered: 'inbox' | 'telegram' | 'webhook' | 'email' | 'both' | 'skipped_quiet';
  /**
   * Why Telegram did not land. Set when prefs wanted Telegram but send failed.
   * Values: missing | rate_limit | network | http_<status>.
   */
  deliverError?: string;
  /** Plain-language reason this row exists — shown in HQ. */
  why: string;
};

export type AlertPayload = {
  kind: AlertKind;
  title: string;
  body: string;
  host?: string;
  count?: number;
  adminPath?: string;
  /** When set, overrides the default batch vs immediate rule. */
  immediate?: boolean;
  why?: string;
};

const PREFS_KEY = 'ultra:alert-prefs';
const INBOX_KEY = 'ultra:alert-inbox';
const SHARED_KEY = 'ultra:alert-first-share';
const INBOX_CAP = 40;
const WEBHOOK_CAP = 12;
const WEBHOOK_WINDOW_MS = 5 * 60_000;
const BATCH_FLUSH_MS = 90_000;
const BATCH_SIZE = 8;
const INBOX_PUT_MS = 20_000;

/** High-signal only. Track pageviews / lands / shares never flip these on. */
const DEFAULT_EVENTS: Record<AlertKind, boolean> = {
  race_started: false,
  first_share: false,
  friend_land: false,
  credit: true,
  rung_rising: true,
  rung_challenger: true,
  rung_banner: true,
  spike: false,
  digest: false,
};

export function alertWhy(kind: AlertKind, extra: { host?: string; count?: number } = {}): string {
  const host = extra.host ? ` · ${extra.host}` : '';
  const n = extra.count && extra.count > 1 ? ` ×${extra.count}` : '';
  const reasons: Record<AlertKind, string> = {
    credit: `Verified unique friend Get-my-link credit (join write)${n}${host}.`,
    rung_rising: `Rung unlock on a real credit — Rising${host}.`,
    rung_challenger: `Rung unlock on a real credit — Challenger${host}.`,
    rung_banner: `Rung unlock on a real credit — #1 banner${host}.`,
    race_started: `New site pasted (join write). Off by default${host}.`,
    first_share: `Share click. Off by default — /api/track no longer fires this${host}.`,
    friend_land: `Share-link open. Off by default — /api/track no longer fires this${host}.`,
    spike: `Rate-limit / abuse flag. Off by default${host}.`,
    digest: 'Scheduled funnel digest. Off unless you set hourly/daily — never auto-enabled.',
  };
  return reasons[kind];
}

export function defaultAlertPrefs(): AlertPrefs {
  return {
    events: { ...DEFAULT_EVENTS },
    webhookUrl: '',
    telegram: true,
    quietHours: { enabled: false, startHour: 22, endHour: 8, tzOffsetMinutes: 0 },
    digest: 'off',
  };
}

function clampHour(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(23, Math.round(n)));
}

export function normalizeAlertPrefs(raw: unknown): AlertPrefs {
  const base = defaultAlertPrefs();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const events = { ...base.events };
  if (o.events && typeof o.events === 'object') {
    for (const k of ALERT_KINDS) {
      const v = (o.events as Record<string, unknown>)[k];
      if (typeof v === 'boolean') events[k] = v;
    }
  }
  const q = o.quietHours && typeof o.quietHours === 'object' ? (o.quietHours as Record<string, unknown>) : {};
  const digest = o.digest === 'hourly' || o.digest === 'daily' ? o.digest : 'off';
  return {
    events,
    webhookUrl: sanitizeWebhookUrl(typeof o.webhookUrl === 'string' ? o.webhookUrl : ''),
    telegram: o.telegram === false ? false : true,
    quietHours: {
      enabled: q.enabled === true,
      startHour: clampHour(q.startHour),
      endHour: clampHour(q.endHour),
      tzOffsetMinutes: Number.isFinite(Number(q.tzOffsetMinutes))
        ? Math.max(-14 * 60, Math.min(14 * 60, Math.round(Number(q.tzOffsetMinutes))))
        : 0,
    },
    digest,
  };
}

export function sanitizeWebhookUrl(url: string): string {
  const t = url.trim().slice(0, 500);
  if (!t) return '';
  try {
    const u = new URL(t);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !local) return '';
    return t;
  } catch {
    return '';
  }
}

export function inQuietHours(prefs: AlertPrefs, now = Date.now()): boolean {
  if (!prefs.quietHours.enabled) return false;
  const shifted = new Date(now + prefs.quietHours.tzOffsetMinutes * 60_000);
  const hour = shifted.getUTCHours();
  const { startHour: s, endHour: e } = prefs.quietHours;
  if (s === e) return true;
  if (s < e) return hour >= s && hour < e;
  return hour >= s || hour < e;
}

export function shouldSendImmediate(kind: AlertKind, count = 1, immediate?: boolean): boolean {
  if (immediate === true) return true;
  if (immediate === false) return false;
  if (kind === 'friend_land' || kind === 'spike' || kind === 'digest') return false;
  if (kind === 'credit') return count >= 1 && count <= 3;
  return true;
}

export function maskWebhookUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  try {
    const parsed = new URL(u);
    const last = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const hint = last.length > 6 ? `${last.slice(0, 3)}…${last.slice(-2)}` : 'set';
    return `${parsed.protocol}//${parsed.host}/…/${hint}`;
  } catch {
    return u.length > 12 ? `${u.slice(0, 10)}…` : 'set';
  }
}

export function buildAlertMessage(item: {
  title: string;
  body: string;
  host?: string;
  count: number;
  adminUrl: string;
}): string {
  const bits = [`**${item.title}**`, item.body];
  if (item.host) bits.push(`Site: ${item.host}`);
  if (item.count > 1) bits.push(`Count: ${item.count}`);
  bits.push(item.adminUrl);
  return bits.join('\n');
}

export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Short HTML for Telegram. No tokens, no visitor invention. */
export function buildTelegramHtml(item: {
  kind: AlertKind;
  title: string;
  body: string;
  host?: string;
  count: number;
  adminUrl: string;
}): string {
  const step = FUNNEL_STEP[item.kind] || item.kind;
  const lines = [
    `<b>${escapeTelegramHtml(item.title)}</b>`,
    escapeTelegramHtml(item.body),
    `Site: ${escapeTelegramHtml(item.host || '—')}`,
    `Step: ${escapeTelegramHtml(step)}${item.count > 1 ? ` · ×${item.count}` : ''}`,
    `<a href="${escapeTelegramHtml(item.adminUrl)}">Open HQ</a>`,
  ];
  return lines.join('\n');
}

export function telegramToken(env: UltraEnv): string {
  return String(env.TELEGRAM_BOT_TOKEN || '').trim();
}

export function telegramChatId(env: UltraEnv): string {
  return String(env.TELEGRAM_CHAT_ID || OWNER_TELEGRAM_CHAT_ID).trim();
}

export function telegramConfigured(env: UltraEnv): boolean {
  return Boolean(telegramToken(env) && telegramChatId(env));
}

export function maskTelegramChatId(chatId: string): string {
  const id = chatId.trim();
  if (!id) return '';
  if (id.length <= 4) return '…set';
  return `…${id.slice(-3)}`;
}

export function parseAlertPrefsBody(body: unknown, current: AlertPrefs): AlertPrefs {
  const incoming = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const next = normalizeAlertPrefs({ ...current, ...incoming });
  if (incoming.webhookUrl === '' || incoming.webhookUrl === null) next.webhookUrl = '';
  if (typeof incoming.webhookUrl === 'string' && /…|\.\.\./.test(incoming.webhookUrl)) {
    next.webhookUrl = current.webhookUrl;
  }
  if (typeof incoming.telegram === 'boolean') next.telegram = incoming.telegram;
  return next;
}

type Batch = { kind: AlertKind; host?: string; count: number; title: string; body: string; first: number };

type AlertMem = {
  prefs: AlertPrefs | null;
  prefsLoaded: boolean;
  inbox: InboxItem[];
  inboxLoaded: boolean;
  firstShare: Set<string>;
  firstShareLoaded: boolean;
  lastInboxPut: number;
  inboxDirty: boolean;
  lastOrigin: string;
  lastDigestHour: string;
  lastDigestDay: string;
};

const g = globalThis as typeof globalThis & { __ULTRA_ALERTS__?: AlertMem };
const batches = new Map<string, Batch>();
const outboundHits: number[] = [];
let lastFlush = 0;

function mem(): AlertMem {
  if (!g.__ULTRA_ALERTS__) {
    g.__ULTRA_ALERTS__ = {
      prefs: null,
      prefsLoaded: false,
      inbox: [],
      inboxLoaded: false,
      firstShare: new Set(),
      firstShareLoaded: false,
      lastInboxPut: 0,
      inboxDirty: false,
      lastOrigin: '',
      lastDigestHour: '',
      lastDigestDay: '',
    };
  }
  return g.__ULTRA_ALERTS__!;
}

export function resetAlertRuntime(): void {
  g.__ULTRA_ALERTS__ = undefined;
  batches.clear();
  outboundHits.length = 0;
  lastFlush = 0;
}

export function rememberAlertOrigin(origin: string): void {
  if (origin) mem().lastOrigin = origin.replace(/\/$/, '');
}

export function alertOrigin(): string {
  return mem().lastOrigin;
}

export async function loadAlertPrefs(env: UltraEnv): Promise<AlertPrefs> {
  const m = mem();
  if (m.prefsLoaded && m.prefs) return m.prefs;
  if (kvBound(env)) {
    try {
      m.prefs = normalizeAlertPrefs(await env.BOARD!.get(PREFS_KEY, 'json'));
    } catch {
      m.prefs = defaultAlertPrefs();
    }
  } else {
    m.prefs = m.prefs || defaultAlertPrefs();
  }
  m.prefsLoaded = true;
  return m.prefs;
}

export async function saveAlertPrefs(env: UltraEnv, next: AlertPrefs): Promise<AlertPrefs> {
  const prefs = normalizeAlertPrefs(next);
  const m = mem();
  m.prefs = prefs;
  m.prefsLoaded = true;
  if (kvBound(env)) {
    try {
      await env.BOARD!.put(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* isolate prefs still apply */
    }
  }
  return prefs;
}

export function resolveWebhookUrl(env: UltraEnv, prefs: AlertPrefs): string {
  return sanitizeWebhookUrl(env.NOTIFY_WEBHOOK_URL || prefs.webhookUrl || '');
}

export function emailConfigured(env: UltraEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO);
}

export function telegramEnabled(env: UltraEnv, prefs: AlertPrefs): boolean {
  return prefs.telegram !== false && telegramConfigured(env);
}

function adminUrl(origin: string, path: string): string {
  const base = (origin || mem().lastOrigin || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function ensureInbox(env: UltraEnv): Promise<InboxItem[]> {
  const m = mem();
  if (m.inboxLoaded) return m.inbox;
  if (kvBound(env)) {
    try {
      const raw = await env.BOARD!.get(INBOX_KEY, 'json');
      m.inbox = Array.isArray(raw) ? (raw as InboxItem[]).map(hydrateInboxItem) : [];
    } catch {
      m.inbox = [];
    }
  }
  m.inboxLoaded = true;
  return m.inbox;
}

async function persistInbox(env: UltraEnv, force: boolean): Promise<void> {
  const m = mem();
  if (!kvBound(env)) return;
  const now = Date.now();
  if (!force && now - m.lastInboxPut < INBOX_PUT_MS) {
    m.inboxDirty = true;
    return;
  }
  try {
    await env.BOARD!.put(INBOX_KEY, JSON.stringify(m.inbox.slice(0, INBOX_CAP)));
    m.lastInboxPut = now;
    m.inboxDirty = false;
  } catch {
    m.inboxDirty = true;
  }
}

async function ensureFirstShare(env: UltraEnv): Promise<Set<string>> {
  const m = mem();
  if (m.firstShareLoaded) return m.firstShare;
  m.firstShareLoaded = true;
  if (kvBound(env)) {
    try {
      const raw = await env.BOARD!.get(SHARED_KEY, 'json');
      if (Array.isArray(raw)) {
        for (const h of raw.slice(0, 400)) if (typeof h === 'string') m.firstShare.add(h);
      }
    } catch {
      /* empty */
    }
  }
  return m.firstShare;
}

function outboundAllowed(): boolean {
  const now = Date.now();
  while (outboundHits.length && now - outboundHits[0] > WEBHOOK_WINDOW_MS) outboundHits.shift();
  if (outboundHits.length >= WEBHOOK_CAP) return false;
  outboundHits.push(now);
  return true;
}

async function deliverWebhook(url: string, text: string, item: InboxItem): Promise<boolean> {
  if (!outboundAllowed()) return false;
  const body = {
    content: text,
    text,
    username: 'ViralRefer',
    kind: item.kind,
    title: item.title,
    host: item.host,
    count: item.count,
    adminPath: item.adminPath,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function deliverTelegram(
  env: UltraEnv,
  html: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = telegramToken(env);
  const chat = telegramChatId(env);
  if (!token || !chat) return { ok: false, reason: 'missing' };
  if (!outboundAllowed()) return { ok: false, reason: 'rate_limit' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    let apiOk = res.ok;
    let code = res.status;
    try {
      const data = (await res.json()) as { ok?: boolean; error_code?: number };
      if (data && data.ok === false) {
        apiOk = false;
        if (typeof data.error_code === 'number' && Number.isFinite(data.error_code)) code = data.error_code;
      } else if (data && data.ok === true) {
        apiOk = true;
      }
    } catch {
      /* keep HTTP status — never log or return the token */
    }
    return { ok: apiOk, reason: apiOk ? undefined : `http_${code}` };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

async function deliverEmail(env: UltraEnv, text: string, item: InboxItem): Promise<boolean> {
  if (!emailConfigured(env)) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.NOTIFY_EMAIL_FROM || 'ViralRefer Site Drops <alerts@viralrefer.app>',
        to: [env.NOTIFY_EMAIL_TO],
        subject: `[Site Drops] ${item.title}`,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function patchDelivered(
  item: InboxItem,
  hooked: boolean,
  mailed: boolean,
  telegram: boolean,
  quiet: boolean,
  telegramError?: string,
): void {
  if (quiet) {
    item.delivered = 'skipped_quiet';
    delete item.deliverError;
  } else {
    const outs = [telegram && 'telegram', hooked && 'webhook', mailed && 'email'].filter(Boolean);
    item.delivered =
      outs.length === 0 ? 'inbox' : outs.length === 1 ? (outs[0] as InboxItem['delivered']) : 'both';
    if (!telegram && telegramError) item.deliverError = telegramError;
    else delete item.deliverError;
  }
  const m = mem();
  const idx = m.inbox.findIndex((x) => x.id === item.id);
  if (idx >= 0) m.inbox[idx] = item;
}

/**
 * Await outbound sends (Telegram first). Pages/Workers drop fire-and-forget
 * fetches after the response; callers must await this or wrap it in waitUntil.
 */
async function deliverOutbound(
  env: UltraEnv,
  origin: string,
  prefs: AlertPrefs,
  item: InboxItem,
  opts: { forceWebhook?: boolean; allowEmail?: boolean },
): Promise<InboxItem> {
  const quiet = inQuietHours(prefs) && !opts.forceWebhook;
  if (quiet) {
    patchDelivered(item, false, false, false, true);
    await persistInbox(env, true);
    return item;
  }
  const webhook = resolveWebhookUrl(env, prefs);
  const hq = adminUrl(origin, item.adminPath);
  const text = buildAlertMessage({
    title: item.title,
    body: item.body,
    host: item.host,
    count: item.count,
    adminUrl: hq,
  });
  const html = buildTelegramHtml({
    kind: item.kind,
    title: item.title,
    body: item.body,
    host: item.host,
    count: item.count,
    adminUrl: hq,
  });
  let hooked = false;
  let mailed = false;
  let telegram = false;
  let telegramError: string | undefined;
  if (prefs.telegram === false) {
    /* HQ turned Telegram off — inbox / webhook / email only */
  } else if (!telegramConfigured(env)) {
    telegramError = 'missing';
  } else {
    const sent = await deliverTelegram(env, html);
    telegram = sent.ok;
    telegramError = sent.ok ? undefined : sent.reason || 'network';
  }
  if (webhook) hooked = await deliverWebhook(webhook, text, item);
  if (opts.allowEmail && emailConfigured(env)) mailed = await deliverEmail(env, text, item);
  patchDelivered(item, hooked, mailed, telegram, false, telegramError);
  await persistInbox(env, true);
  return item;
}

function hydrateInboxItem(raw: InboxItem): InboxItem {
  return {
    ...raw,
    why: raw.why || alertWhy(raw.kind, { host: raw.host, count: raw.count }),
  };
}

async function commitItem(
  env: UltraEnv,
  origin: string,
  payload: AlertPayload,
  opts: { forceWebhook?: boolean } = {},
): Promise<InboxItem> {
  rememberAlertOrigin(origin);
  const prefs = await loadAlertPrefs(env);
  const count = Math.max(1, payload.count || 1);
  const adminPath =
    payload.adminPath || `/admin/?focus=${payload.kind}${payload.host ? `&host=${encodeURIComponent(payload.host)}` : ''}`;
  const item: InboxItem = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    host: payload.host,
    count,
    adminPath,
    delivered: 'inbox',
    why: payload.why || alertWhy(payload.kind, { host: payload.host, count }),
  };
  const inbox = await ensureInbox(env);
  inbox.unshift(item);
  mem().inbox = inbox.slice(0, INBOX_CAP);
  const forcePut = Boolean(opts.forceWebhook || shouldSendImmediate(payload.kind, count, payload.immediate));
  await persistInbox(env, forcePut);
  await deliverOutbound(env, origin, prefs, item, {
    forceWebhook: opts.forceWebhook,
    allowEmail: shouldSendImmediate(payload.kind, count, payload.immediate) || Boolean(opts.forceWebhook),
  });
  return item;
}

function enqueueBatch(payload: AlertPayload): void {
  const key = `${payload.kind}:${payload.host || '*'}`;
  const existing = batches.get(key);
  if (existing) {
    existing.count += payload.count || 1;
    existing.body = `${existing.count} ${payload.kind.replace(/_/g, ' ')} events`;
    return;
  }
  batches.set(key, {
    kind: payload.kind,
    host: payload.host,
    count: payload.count || 1,
    title: payload.title,
    body: payload.body,
    first: Date.now(),
  });
}

export async function flushAlertBatches(env: UltraEnv, origin: string, force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastFlush < 8_000) return 0;
  lastFlush = now;
  rememberAlertOrigin(origin);
  let n = 0;
  for (const [key, batch] of [...batches.entries()]) {
    const aged = now - batch.first >= BATCH_FLUSH_MS;
    const fat = batch.count >= BATCH_SIZE;
    if (!force && !aged && !fat) continue;
    batches.delete(key);
    const label =
      batch.count === 1 ? batch.body : `${batch.count} in the last few minutes — ${batch.kind.replace(/_/g, ' ')}`;
    await commitItem(env, origin, {
      kind: batch.kind,
      title: batch.count > 1 ? `${batch.title} ×${batch.count}` : batch.title,
      body: label,
      host: batch.host,
      count: batch.count,
      immediate: true,
    });
    n += 1;
  }
  if (mem().inboxDirty) await persistInbox(env, true);
  return n;
}

export function pendingBatchCount(): number {
  return batches.size;
}

export async function emitAlert(
  env: UltraEnv,
  origin: string,
  payload: AlertPayload,
  opts: { force?: boolean; request?: Request } = {},
): Promise<InboxItem | null> {
  rememberAlertOrigin(origin);
  if (!opts.force && opts.request) {
    const gate = await shouldSkipStats(env, opts.request);
    if (gate.skip) return null;
  }
  const prefs = await loadAlertPrefs(env);
  if (!opts.force && payload.kind === 'digest' && prefs.digest === 'off') return null;
  if (!opts.force && payload.kind !== 'digest' && !prefs.events[payload.kind]) return null;

  const count = payload.count || 1;
  if (!opts.force && !shouldSendImmediate(payload.kind, count, payload.immediate)) {
    enqueueBatch(payload);
    await flushAlertBatches(env, origin);
    return null;
  }
  return commitItem(env, origin, payload, { forceWebhook: opts.force });
}

export async function maybeFirstShareAlert(env: UltraEnv, origin: string, host: string): Promise<void> {
  if (!host) return;
  const set = await ensureFirstShare(env);
  if (set.has(host)) return;
  set.add(host);
  if (kvBound(env)) {
    try {
      await env.BOARD!.put(SHARED_KEY, JSON.stringify([...set].slice(-400)));
    } catch {
      /* isolate set still blocks dupes */
    }
  }
  await emitAlert(env, origin, {
    kind: 'first_share',
    title: 'First share click',
    body: `${host} left the nest — someone copied or opened a share target.`,
    host,
    count: 1,
  });
}

export async function emitJoinAlerts(args: {
  env: UltraEnv;
  origin: string;
  host: string;
  isNewSite: boolean;
  credited: boolean;
  creditN: number;
  creditHost?: string;
  previousRung: string;
  nextRung: string;
  request?: Request;
}): Promise<void> {
  const { env, origin, host, request } = args;
  if (request) {
    const gate = await shouldSkipStats(env, request);
    if (gate.skip) return;
  }
  if (args.isNewSite) {
    await emitAlert(env, origin, {
      kind: 'race_started',
      title: 'New site pasted',
      body: `${host} just entered the weekly race.`,
      host,
      count: 1,
    }, { request });
  }
  const creditHost = args.creditHost || host;
  if (args.credited && args.creditN > 0) {
    const climb =
      args.creditN === 1
        ? '1st verified credit — on the board.'
        : args.creditN === 2
          ? '2nd credit — climbing.'
          : args.creditN === 3
            ? '3rd credit — Challenger range.'
            : `${args.creditN} verified credits.`;
    await emitAlert(env, origin, {
      kind: 'credit',
      title: args.creditN <= 3 ? `Credit #${args.creditN}` : 'Verified credits',
      body: `${creditHost}: ${climb}`,
      host: creditHost,
      count: args.creditN <= 3 ? args.creditN : 1,
      immediate: args.creditN <= 3,
    }, { request });
  }
  if (args.previousRung !== args.nextRung) {
    if (args.nextRung === 'rising') {
      await emitAlert(env, origin, {
        kind: 'rung_rising',
        title: 'Rising unlocked',
        body: `${creditHost} earned a unique credit inside the first hour.`,
        host: creditHost,
      }, { request });
    } else if (args.nextRung === 'challenger') {
      await emitAlert(env, origin, {
        kind: 'rung_challenger',
        title: 'Challenger',
        body: `${creditHost} is #2 or #3 this week.`,
        host: creditHost,
      }, { request });
    } else if (args.nextRung === 'banner') {
      await emitAlert(env, origin, {
        kind: 'rung_banner',
        title: '#1 banner claim',
        body: `${creditHost} is the weekly lead.`,
        host: creditHost,
      }, { request });
    }
  }
}

export async function emitSpikeAlert(env: UltraEnv, origin: string, reason: string, ip?: string, request?: Request): Promise<void> {
  await emitAlert(env, origin, {
    kind: 'spike',
    title: 'Spike / abuse flag',
    body: `${reason}${ip ? ` · ${ip}` : ''}`,
    count: 1,
  }, { request });
}

export async function emitDigest(
  env: UltraEnv,
  origin: string,
  period: 'hourly' | 'daily',
  key: string,
  summary: string,
): Promise<void> {
  const prefs = await loadAlertPrefs(env);
  if (prefs.digest !== period) return;
  if (lastDigestKey(period) === key) return;
  markDigestSent(period, key);
  await emitAlert(env, origin, {
    kind: 'digest',
    title: period === 'hourly' ? 'Hourly funnel digest' : 'Daily funnel digest',
    body: summary,
    count: 1,
    immediate: true,
  });
}

export function markDigestSent(period: 'hourly' | 'daily', key: string): void {
  if (period === 'hourly') mem().lastDigestHour = key;
  else mem().lastDigestDay = key;
}

export function lastDigestKey(period: 'hourly' | 'daily'): string {
  return period === 'hourly' ? mem().lastDigestHour : mem().lastDigestDay;
}

export async function readAlertInbox(env: UltraEnv): Promise<InboxItem[]> {
  return ensureInbox(env);
}

/** Empty isolate + KV inbox. Batches are dropped so they cannot refill the list. */
export async function clearAlertInbox(env: UltraEnv): Promise<{ cleared: number }> {
  await ensureInbox(env);
  const m = mem();
  const cleared = m.inbox.length;
  m.inbox = [];
  m.inboxDirty = false;
  batches.clear();
  lastFlush = 0;
  if (kvBound(env)) {
    try {
      await env.BOARD!.put(INBOX_KEY, JSON.stringify([]));
      m.lastInboxPut = Date.now();
    } catch {
      m.inboxDirty = true;
    }
  }
  return { cleared };
}

export async function testAlert(env: UltraEnv, origin: string): Promise<InboxItem> {
  return commitItem(
    env,
    origin,
    {
      kind: 'digest',
      title: 'Test notification',
      body: `Owner HQ test ping. When TELEGRAM_BOT_TOKEN is set this hits chat ${OWNER_TELEGRAM_CHAT_ID}. Missing token stays in this inbox.`,
      count: 1,
      adminPath: '/admin/?focus=test',
      immediate: true,
      why: 'Owner HQ Test ping — you clicked Test ping. Not a visitor event.',
    },
    { forceWebhook: true },
  );
}

export function alertPublicView(env: UltraEnv, prefs: AlertPrefs, inbox: InboxItem[]) {
  const envHook = Boolean(env.NOTIFY_WEBHOOK_URL);
  const chat = telegramChatId(env);
  const tokenOn = Boolean(telegramToken(env));
  return {
    events: prefs.events,
    digest: prefs.digest,
    quietHours: prefs.quietHours,
    telegram: prefs.telegram !== false,
    telegramConfigured: telegramConfigured(env),
    telegramTokenConfigured: tokenOn,
    telegramChatMasked: chat ? maskTelegramChatId(chat) : '',
    telegramOwnerHint: OWNER_TELEGRAM_CHAT_ID,
    webhookUrl: maskWebhookUrl(resolveWebhookUrl(env, prefs)),
    webhookFromEnv: envHook,
    webhookConfigured: Boolean(resolveWebhookUrl(env, prefs)),
    emailConfigured: emailConfigured(env),
    inbox,
  };
}

export function funnelDigestLine(b: {
  lands?: number;
  pastes?: number;
  joins?: number;
  shares?: number;
  friendLands?: number;
  credits?: number;
  burstIp?: number;
}): string {
  return `Lands ${b.lands ?? 0} · pastes ${b.pastes ?? 0} · joins ${b.joins ?? 0} · shares ${b.shares ?? 0} · friend lands ${b.friendLands ?? 0} · credits ${b.credits ?? 0}${b.burstIp ? ` · spikes ${b.burstIp}` : ''}`;
}
