/**
 * Post marketing content to Telegram channel (default @viralrefer).
 * Reuses FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN; channel via GROWTH_POST_TELEGRAM_CHAT_ID.
 */

import { getFunnelNotifyTelegramBotToken } from './funnel-notify.ts';

const DEFAULT_CHANNEL = '@viralrefer';

function readEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getGrowthPostTelegramChatId(): string {
  const raw = String(readEnv('GROWTH_POST_TELEGRAM_CHAT_ID') || '').trim();
  return raw || DEFAULT_CHANNEL;
}

export function isTelegramMarketingConfigured(): boolean {
  return !!getFunnelNotifyTelegramBotToken();
}

function decodeBase64ToBytes(data: string): Uint8Array {
  const cleaned = data.includes(',') ? data.split(',').pop()! : data;
  const binary = atob(cleaned.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function postTelegramMarketing(input: {
  text: string;
  chatId?: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<{ ok: boolean; messageId?: number; error?: string; chatId?: string }> {
  const token = getFunnelNotifyTelegramBotToken();
  if (!token) {
    return { ok: false, error: 'FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN not configured' };
  }

  const chatId = String(input.chatId || getGrowthPostTelegramChatId()).trim();
  const text = String(input.text || '').trim().slice(0, 1024);
  if (!text) return { ok: false, error: 'text required' };

  try {
    if (input.imageBase64) {
      const mime = input.imageMime || 'image/png';
      const bytes = decodeBase64ToBytes(input.imageBase64);
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', text);
      form.append('photo', new Blob([bytes], { type: mime }), 'graphic.png');

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.ok) {
        return { ok: false, error: json.description || 'sendPhoto failed', chatId };
      }
      return { ok: true, messageId: json.result?.message_id, chatId };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: false,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, error: json.description || 'sendMessage failed', chatId };
    }
    return { ok: true, messageId: json.result?.message_id, chatId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'telegram error', chatId };
  }
}