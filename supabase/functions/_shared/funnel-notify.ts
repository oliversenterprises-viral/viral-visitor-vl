/**
 * Optional off-site funnel alerts — fires when visitor_events are recorded server-side.
 * Preferred: Telegram Bot API (FUNNEL_NOTIFY_TELEGRAM_* secrets).
 * Fallback: generic webhook URL (FUNNEL_NOTIFY_WEBHOOK_URL).
 */

import { isTestVisitorFunnelEvent } from './visitor-funnel-test.ts';

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

export function isFunnelNotifyImportantOnly(): boolean {
  return String(readEnv('FUNNEL_NOTIFY_IMPORTANT_ONLY') || '').trim().toLowerCase() === 'true';
}

export function getFunnelNotifyChannel(): FunnelNotifyChannel | null {
  if (isFunnelTelegramNotifyConfigured()) return 'telegram';
  if (getFunnelNotifyWebhookUrl()) return 'webhook';
  return null;
}

export function isFunnelOffsiteNotifyEnabled(): boolean {
  return !!getFunnelNotifyChannel();
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
  if (isTestVisitorFunnelEvent(row as Record<string, unknown>)) return false;
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