/**
 * Optional off-site funnel alerts — fires when visitor_events are recorded server-side.
 * Preferred: Telegram Bot API (FUNNEL_NOTIFY_TELEGRAM_* secrets).
 * Fallback: generic webhook URL (FUNNEL_NOTIFY_WEBHOOK_URL).
 */

import { isAgentFunnelNotifyTraffic } from './visitor-funnel-test.ts';
import { isAgentAutomationMetadata, isAutomationUserAgent } from './test-referral.ts';

export const FUNNEL_NOTIFY_IMPORTANT_STEPS = new Set([
  'getreferrallink',
  'copyreferrallink',
  'sharereferral',
  'openprizeclaim',
  'submitprizeclaim',
]);

export type FunnelNotifyChannel = 'telegram' | 'webhook';

export type FunnelNotifyRow = {
  event_name: string;
  ref_code?: string | null;
  utm_source?: string | null;
  country_code?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

function readEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getFunnelNotifyTelegramBotToken(): string | null {
  const token = String(readEnv('FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN') || '').trim();
  return token || null;
}

export function getFunnelNotifyTelegramChatId(): string | null {
  const chatId = String(readEnv('FUNNEL_NOTIFY_TELEGRAM_CHAT_ID') || '').trim();
  return chatId || null;
}

export function isFunnelTelegramNotifyConfigured(): boolean {
  return !!(getFunnelNotifyTelegramBotToken() && getFunnelNotifyTelegramChatId());
}

export function getFunnelNotifyWebhookUrl(): string | null {
  const url = String(readEnv('FUNNEL_NOTIFY_WEBHOOK_URL') || '').trim();
  return url || null;
}

/** Default on — only Get/Copy/Share/claim ping Telegram. Set false to alert every recorded step. */
export function isFunnelNotifyImportantOnly(): boolean {
  const flag = String(readEnv('FUNNEL_NOTIFY_IMPORTANT_ONLY') || 'true')
    .trim()
    .toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off';
}

export function getFunnelNotifyChannel(): FunnelNotifyChannel | null {
  if (isFunnelTelegramNotifyConfigured()) return 'telegram';
  if (getFunnelNotifyWebhookUrl()) return 'webhook';
  return null;
}

export function isFunnelOffsiteNotifyEnabled(): boolean {
  return !!getFunnelNotifyChannel();
}

/** Public Command / admin status. Never include token or chat id. */
export type FunnelNotifyStatus = {
  enabled: boolean;
  importantOnly: boolean;
  channel: FunnelNotifyChannel | null;
};

export function getFunnelNotifyStatus(): FunnelNotifyStatus {
  return {
    enabled: isFunnelOffsiteNotifyEnabled(),
    importantOnly: isFunnelNotifyImportantOnly(),
    channel: getFunnelNotifyChannel(),
  };
}

/** Command Desk field. Telegram only — webhook-only is not connected. */
export function getOwnerDeskTelegramStatus(): {
  connected: boolean;
  importantOnly: boolean;
} {
  const status = getFunnelNotifyStatus();
  return {
    connected: status.channel === 'telegram',
    importantOnly: status.importantOnly,
  };
}

/** Keep a promise alive after the HTTP response on Supabase Edge (Deno). */
export function edgeWaitUntil(task: Promise<unknown>): void {
  const g = globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } };
  if (typeof g.EdgeRuntime?.waitUntil === 'function') {
    g.EdgeRuntime.waitUntil(task);
    return;
  }
  void task;
}

export function normalizeFunnelNotifyStep(step: string | undefined): string {
  return String(step || '').trim().toLowerCase();
}

export function isImportantFunnelNotifyStep(step: string | undefined): boolean {
  return FUNNEL_NOTIFY_IMPORTANT_STEPS.has(normalizeFunnelNotifyStep(step));
}

/** Whether this row should trigger an off-site alert (test/owner rows excluded). */
export function shouldNotifyFunnelEvent(row: FunnelNotifyRow): boolean {
  if (!isFunnelOffsiteNotifyEnabled()) return false;
  if (isAgentFunnelNotifyTraffic(row as Record<string, unknown>)) return false;
  if (isFunnelNotifyImportantOnly()) {
    return isImportantFunnelNotifyStep(row.event_name);
  }
  return true;
}

/** Human-readable one-line alert body. */
export function buildFunnelNotifyText(row: FunnelNotifyRow): string {
  const step = String(row.event_name || 'event').trim() || 'event';
  const parts = [`Funnel · ${step}`];
  const ref = String(row.ref_code || '').trim();
  parts.push(ref ? `ref:${ref}` : 'direct');
  const country = String(row.country_code || '').trim();
  if (country) parts.push(country);
  const source = String(row.utm_source || '').trim();
  if (source) parts.push(source);
  return parts.join(' · ');
}

export function buildTelegramNotifyRequest(
  row: FunnelNotifyRow,
  botToken: string,
  chatId: string,
): { url: string; body: string; headers: Record<string, string> } {
  const text = `🔔 ${buildFunnelNotifyText(row)}`;
  return {
    url: `https://api.telegram.org/bot${botToken}/sendMessage`,
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    headers: { 'Content-Type': 'application/json' },
  };
}

export function buildFunnelNotifyPayload(
  row: FunnelNotifyRow,
  webhookUrl: string,
): { body: string; headers: Record<string, string> } {
  const text = buildFunnelNotifyText(row);
  const at = row.created_at || new Date().toISOString();

  if (webhookUrl.includes('discord.com/api/webhooks')) {
    return {
      body: JSON.stringify({ content: `🔔 ${text}` }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  if (webhookUrl.includes('ntfy.sh')) {
    return {
      body: text,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Title: 'ViralRefer funnel',
        Tags: 'chart_with_upwards_trend',
      },
    };
  }

  return {
    body: JSON.stringify({
      text,
      title: 'ViralRefer funnel',
      event_name: row.event_name,
      ref_code: row.ref_code ?? null,
      utm_source: row.utm_source ?? null,
      country_code: row.country_code ?? null,
      at,
    }),
    headers: { 'Content-Type': 'application/json' },
  };
}

async function postNotify(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Deliver alert via Telegram or webhook (no-op when disabled or filtered). */
export async function dispatchFunnelOffsiteNotify(
  row: FunnelNotifyRow,
): Promise<{ ok: boolean; skipped?: string; channel?: FunnelNotifyChannel }> {
  if (!shouldNotifyFunnelEvent(row)) {
    return { ok: false, skipped: 'filtered' };
  }

  const channel = getFunnelNotifyChannel();
  if (!channel) return { ok: false, skipped: 'disabled' };

  if (channel === 'telegram') {
    const botToken = getFunnelNotifyTelegramBotToken()!;
    const chatId = getFunnelNotifyTelegramChatId()!;
    const req = buildTelegramNotifyRequest(row, botToken, chatId);
    const ok = await postNotify(req.url, req.body, req.headers);
    return { ok, channel: 'telegram' };
  }

  const url = getFunnelNotifyWebhookUrl()!;
  const { body, headers } = buildFunnelNotifyPayload(row, url);
  const ok = await postNotify(url, body, headers);
  return { ok, channel: 'webhook' };
}

export type PromoterSignupNotifyRow = {
  name: string;
  code: string;
  link?: string | null;
};

export function buildPromoterSignupNotifyText(row: PromoterSignupNotifyRow): string {
  const name = String(row.name || '').trim() || 'someone';
  const code = String(row.code || '').trim() || '—';
  const link = String(row.link || '').trim() || `https://www.viralrefer.app/a/${code}`;
  return `🤝 New promoter · ${name} · ${code}\n${link}`;
}

/** Telegram/webhook when someone self-serves a promoter link. */
export async function dispatchPromoterSignupNotify(
  row: PromoterSignupNotifyRow,
): Promise<{ ok: boolean; skipped?: string; channel?: FunnelNotifyChannel }> {
  if (!isFunnelOffsiteNotifyEnabled()) {
    return { ok: false, skipped: 'disabled' };
  }
  const channel = getFunnelNotifyChannel();
  if (!channel) return { ok: false, skipped: 'disabled' };

  const text = buildPromoterSignupNotifyText(row);

  if (channel === 'telegram') {
    const botToken = getFunnelNotifyTelegramBotToken()!;
    const chatId = getFunnelNotifyTelegramChatId()!;
    const ok = await postNotify(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      { 'Content-Type': 'application/json' },
    );
    return { ok, channel: 'telegram' };
  }

  const url = getFunnelNotifyWebhookUrl()!;
  let body: string;
  let headers: Record<string, string>;
  if (url.includes('discord.com/api/webhooks')) {
    body = JSON.stringify({ content: text });
    headers = { 'Content-Type': 'application/json' };
  } else if (url.includes('ntfy.sh')) {
    body = text;
    headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'ViralRefer new promoter',
      Tags: 'handshake',
    };
  } else {
    body = JSON.stringify({
      text,
      title: 'ViralRefer new promoter',
      name: row.name,
      code: row.code,
      link: row.link ?? null,
      at: new Date().toISOString(),
    });
    headers = { 'Content-Type': 'application/json' };
  }
  const ok = await postNotify(url, body, headers);
  return { ok, channel: 'webhook' };
}

/** Owner broadcaster click zones (must match client viral-zones). */
export const BROADCAST_CLICK_ZONES = new Set([
  'owner-broadcast-link',
  'owner-broadcast-sponsor',
  'owner-broadcast-sponsor-img',
]);

export function isBroadcastClickZone(zoneId: string | undefined): boolean {
  return BROADCAST_CLICK_ZONES.has(String(zoneId || '').trim());
}

/**
 * Broadcast click alerts use the same Telegram/webhook channel as funnel alerts.
 * Independent of FUNNEL_NOTIFY_IMPORTANT_ONLY (those only filter funnel visitor_events).
 * Disable with FUNNEL_NOTIFY_BROADCAST_CLICKS=false.
 */
export function isBroadcastClickNotifyEnabled(): boolean {
  if (!isFunnelOffsiteNotifyEnabled()) return false;
  const flag = String(readEnv('FUNNEL_NOTIFY_BROADCAST_CLICKS') || 'true')
    .trim()
    .toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off';
}

export type BroadcastClickNotifyRow = {
  zone_id: string;
  href?: string | null;
  kind?: string | null;
  broadcast_id?: string | null;
  label?: string | null;
  path?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function buildBroadcastClickNotifyText(row: BroadcastClickNotifyRow): string {
  const zone = String(row.zone_id || '').trim();
  const kindLabel =
    zone === 'owner-broadcast-sponsor'
      ? 'Sponsor CTA'
      : zone === 'owner-broadcast-sponsor-img'
        ? 'Sponsor image'
        : 'Body link';
  const href = String(row.href || '').trim();
  const label = String(row.label || '').trim();
  const bcId = String(row.broadcast_id || '').trim();
  const parts = [`📣 Broadcast click · ${kindLabel}`];
  if (label) parts.push(`“${label.slice(0, 60)}”`);
  if (href) parts.push(href.slice(0, 180));
  if (bcId) parts.push(`id:${bcId.slice(0, 40)}`);
  return parts.join('\n');
}

/** Fire-and-forget safe Telegram/webhook for owner broadcaster link clicks. */
export async function dispatchBroadcastClickNotify(
  row: BroadcastClickNotifyRow,
): Promise<{ ok: boolean; skipped?: string; channel?: FunnelNotifyChannel }> {
  if (!isBroadcastClickNotifyEnabled()) {
    return { ok: false, skipped: 'disabled' };
  }
  if (!isBroadcastClickZone(row.zone_id)) {
    return { ok: false, skipped: 'not_broadcast' };
  }
  const ua = String(row.user_agent || '').trim();
  if (!ua || isAutomationUserAgent(ua) || isAgentAutomationMetadata(row.metadata)) {
    return { ok: false, skipped: 'agent' };
  }

  const channel = getFunnelNotifyChannel();
  if (!channel) return { ok: false, skipped: 'disabled' };

  const text = buildBroadcastClickNotifyText(row);

  if (channel === 'telegram') {
    const botToken = getFunnelNotifyTelegramBotToken()!;
    const chatId = getFunnelNotifyTelegramChatId()!;
    const ok = await postNotify(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      { 'Content-Type': 'application/json' },
    );
    return { ok, channel: 'telegram' };
  }

  const url = getFunnelNotifyWebhookUrl()!;
  let body: string;
  let headers: Record<string, string>;
  if (url.includes('discord.com/api/webhooks')) {
    body = JSON.stringify({ content: text });
    headers = { 'Content-Type': 'application/json' };
  } else if (url.includes('ntfy.sh')) {
    body = text;
    headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'ViralRefer broadcast click',
      Tags: 'mega',
    };
  } else {
    body = JSON.stringify({
      text,
      title: 'ViralRefer broadcast click',
      zone_id: row.zone_id,
      href: row.href ?? null,
      kind: row.kind ?? null,
      broadcast_id: row.broadcast_id ?? null,
      at: new Date().toISOString(),
    });
    headers = { 'Content-Type': 'application/json' };
  }
  const ok = await postNotify(url, body, headers);
  return { ok, channel: 'webhook' };
}

export type SiteAddedKind = 'entered' | 'rising' | 'challenger' | 'text' | 'banner';

export type SiteAddedNotifyRow = {
  kind: SiteAddedKind;
  code: string;
  url: string;
  label?: string | null;
};

/** Real submitted website — not the placeholder /r/ race page. */
export function isAddedSiteUrl(url: string | undefined | null): boolean {
  const href = String(url || '').trim();
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'viralrefer.app' && /^\/r\//i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildSiteAddedNotifyText(row: SiteAddedNotifyRow): string {
  const code = String(row.code || '').trim() || '—';
  const url = String(row.url || '').trim() || '—';
  const label = String(row.label || '').trim();
  const slot =
    row.kind === 'entered'
      ? 'Just entered (15 min)'
      : row.kind === 'rising'
        ? 'Rising drop (1 hour)'
        : row.kind === 'challenger'
          ? 'Challenger strip'
          : row.kind === 'text'
            ? 'Week text line'
            : '7-day prize banner';
  const lines = [`Site added. ${slot}.`, code];
  if (label) lines.push(label.slice(0, 80));
  lines.push(url.slice(0, 180));
  return lines.join('\n');
}

/** Telegram/webhook when a racer puts their website on the homepage. */
export async function dispatchSiteAddedNotify(
  row: SiteAddedNotifyRow,
): Promise<{ ok: boolean; skipped?: string; channel?: FunnelNotifyChannel }> {
  if (!isFunnelOffsiteNotifyEnabled()) {
    return { ok: false, skipped: 'disabled' };
  }
  if (!isAddedSiteUrl(row.url)) {
    return { ok: false, skipped: 'not_a_site' };
  }
  const channel = getFunnelNotifyChannel();
  if (!channel) return { ok: false, skipped: 'disabled' };

  const text = buildSiteAddedNotifyText(row);

  if (channel === 'telegram') {
    const botToken = getFunnelNotifyTelegramBotToken()!;
    const chatId = getFunnelNotifyTelegramChatId()!;
    const ok = await postNotify(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      { 'Content-Type': 'application/json' },
    );
    return { ok, channel: 'telegram' };
  }

  const hook = getFunnelNotifyWebhookUrl()!;
  let body: string;
  let headers: Record<string, string>;
  if (hook.includes('discord.com/api/webhooks')) {
    body = JSON.stringify({ content: text });
    headers = { 'Content-Type': 'application/json' };
  } else if (hook.includes('ntfy.sh')) {
    body = text;
    headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'ViralRefer site added',
      Tags: 'globe_with_meridians',
    };
  } else {
    body = JSON.stringify({
      text,
      title: 'ViralRefer site added',
      kind: row.kind,
      code: row.code,
      url: row.url,
      label: row.label ?? null,
      at: new Date().toISOString(),
    });
    headers = { 'Content-Type': 'application/json' };
  }
  const ok = await postNotify(hook, body, headers);
  return { ok, channel: 'webhook' };
}

/** Homepage prize banner, Site Drops, week text line, owner featured. Must match client viral-zones. */
export const OUTBOUND_SITE_CLICK_ZONES = new Set([
  'prize-banner',
  'site-drop',
  'race-text-spot',
  'owner-featured',
]);

export function isOutboundSiteClickZone(zoneId: string | undefined): boolean {
  return OUTBOUND_SITE_CLICK_ZONES.has(String(zoneId || '').trim());
}

/**
 * Site/banner visit alerts use the same Telegram/webhook as funnel alerts.
 * Independent of FUNNEL_NOTIFY_IMPORTANT_ONLY.
 * Disable with FUNNEL_NOTIFY_SITE_CLICKS=false.
 */
export function isOutboundSiteClickNotifyEnabled(): boolean {
  if (!isFunnelOffsiteNotifyEnabled()) return false;
  const flag = String(readEnv('FUNNEL_NOTIFY_SITE_CLICKS') || 'true')
    .trim()
    .toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off';
}

export type OutboundSiteClickNotifyRow = {
  zone_id: string;
  href?: string | null;
  label?: string | null;
  path?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function buildOutboundSiteClickNotifyText(row: OutboundSiteClickNotifyRow): string {
  const zone = String(row.zone_id || '').trim();
  const kindLabel =
    zone === 'prize-banner'
      ? 'Prize banner'
      : zone === 'site-drop'
        ? 'Site Drop'
        : zone === 'race-text-spot'
          ? 'Week text line'
          : zone === 'owner-featured'
            ? 'Featured site'
            : 'Site';
  const href = String(row.href || '').trim();
  const label = String(row.label || '').trim();
  const parts = [`Site click. ${kindLabel}.`];
  if (label) parts.push(`“${label.slice(0, 60)}”`);
  if (href) parts.push(href.slice(0, 180));
  return parts.join('\n');
}

function httpHref(raw: string | null | undefined): string {
  const href = String(raw || '').trim();
  if (!/^https?:\/\//i.test(href)) return '';
  return href;
}

/** Fire-and-forget Telegram/webhook when a visitor taps a homepage site or banner. */
export async function dispatchOutboundSiteClickNotify(
  row: OutboundSiteClickNotifyRow,
): Promise<{ ok: boolean; skipped?: string; channel?: FunnelNotifyChannel }> {
  if (!isOutboundSiteClickNotifyEnabled()) {
    return { ok: false, skipped: 'disabled' };
  }
  if (!isOutboundSiteClickZone(row.zone_id)) {
    return { ok: false, skipped: 'not_outbound' };
  }
  const href = httpHref(row.href);
  if (!href) return { ok: false, skipped: 'no_href' };
  const ua = String(row.user_agent || '').trim();
  if (!ua || isAutomationUserAgent(ua) || isAgentAutomationMetadata(row.metadata)) {
    return { ok: false, skipped: 'agent' };
  }

  const channel = getFunnelNotifyChannel();
  if (!channel) return { ok: false, skipped: 'disabled' };

  const text = buildOutboundSiteClickNotifyText({ ...row, href });

  if (channel === 'telegram') {
    const botToken = getFunnelNotifyTelegramBotToken()!;
    const chatId = getFunnelNotifyTelegramChatId()!;
    const ok = await postNotify(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      { 'Content-Type': 'application/json' },
    );
    return { ok, channel: 'telegram' };
  }

  const hook = getFunnelNotifyWebhookUrl()!;
  let body: string;
  let headers: Record<string, string>;
  if (hook.includes('discord.com/api/webhooks')) {
    body = JSON.stringify({ content: text });
    headers = { 'Content-Type': 'application/json' };
  } else if (hook.includes('ntfy.sh')) {
    body = text;
    headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'ViralRefer site click',
      Tags: 'round_pushpin',
    };
  } else {
    body = JSON.stringify({
      text,
      title: 'ViralRefer site click',
      zone_id: row.zone_id,
      href,
      label: row.label ?? null,
      at: new Date().toISOString(),
    });
    headers = { 'Content-Type': 'application/json' };
  }
  const ok = await postNotify(hook, body, headers);
  return { ok, channel: 'webhook' };
}