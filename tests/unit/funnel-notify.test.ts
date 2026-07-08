import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildFunnelNotifyPayload,
  buildFunnelNotifyText,
  buildTelegramNotifyRequest,
  getFunnelNotifyChannel,
  isFunnelOffsiteNotifyEnabled,
  isImportantFunnelNotifyStep,
  shouldNotifyFunnelEvent,
} from '../../supabase/functions/_shared/funnel-notify';

describe('funnel-notify', () => {
  const prevUrl = process.env.FUNNEL_NOTIFY_WEBHOOK_URL;
  const prevToken = process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID;
  const prevImportant = process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY;

  beforeEach(() => {
    delete process.env.FUNNEL_NOTIFY_WEBHOOK_URL;
    delete process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
    delete process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID;
    delete process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY;
  });

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.FUNNEL_NOTIFY_WEBHOOK_URL;
    else process.env.FUNNEL_NOTIFY_WEBHOOK_URL = prevUrl;
    if (prevToken === undefined) delete process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
    else process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = prevToken;
    if (prevChat === undefined) delete process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID;
    else process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = prevChat;
    if (prevImportant === undefined) delete process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY;
    else process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY = prevImportant;
  });

  it('isImportantFunnelNotifyStep excludes landings', () => {
    expect(isImportantFunnelNotifyStep('GetReferralLink')).toBe(true);
    expect(isImportantFunnelNotifyStep('SiteLanding')).toBe(false);
  });

  it('prefers Telegram over webhook when both configured', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    process.env.FUNNEL_NOTIFY_WEBHOOK_URL = 'https://ntfy.sh/topic';
    expect(getFunnelNotifyChannel()).toBe('telegram');
    expect(isFunnelOffsiteNotifyEnabled()).toBe(true);
  });

  it('shouldNotifyFunnelEvent skips test ref codes', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'GetReferralLink',
        ref_code: 'VIRAL-LANDING-TEST',
      }),
    ).toBe(false);
  });

  it('shouldNotifyFunnelEvent allows all steps by default', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(shouldNotifyFunnelEvent({ event_name: 'SiteLanding' })).toBe(true);
    expect(shouldNotifyFunnelEvent({ event_name: 'GetReferralLink', ref_code: 'VIRAL-ABC' })).toBe(
      true,
    );
  });

  it('shouldNotifyFunnelEvent respects important-only mode', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY = 'true';
    expect(shouldNotifyFunnelEvent({ event_name: 'SiteLanding' })).toBe(false);
    expect(shouldNotifyFunnelEvent({ event_name: 'ShareReferral' })).toBe(true);
  });

  it('buildFunnelNotifyText includes ref or direct', () => {
    expect(buildFunnelNotifyText({ event_name: 'GetReferralLink', ref_code: 'VIRAL-A' })).toContain(
      'ref:VIRAL-A',
    );
    expect(buildFunnelNotifyText({ event_name: 'SiteLanding' })).toContain('direct');
  });

  it('buildTelegramNotifyRequest targets sendMessage API', () => {
    const row = { event_name: 'CopyReferralLink', ref_code: 'VIRAL-Z' };
    const req = buildTelegramNotifyRequest(row, '123:abc', '456');
    expect(req.url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    const body = JSON.parse(req.body);
    expect(body.chat_id).toBe('456');
    expect(body.text).toContain('CopyReferralLink');
    expect(body.disable_web_page_preview).toBe(true);
  });

  it('buildFunnelNotifyPayload formats discord and ntfy', () => {
    const row = { event_name: 'CopyReferralLink', ref_code: 'VIRAL-Z' };
    const discord = buildFunnelNotifyPayload(row, 'https://discord.com/api/webhooks/x/y');
    expect(JSON.parse(discord.body).content).toContain('CopyReferralLink');
    const ntfy = buildFunnelNotifyPayload(row, 'https://ntfy.sh/my-topic');
    expect(ntfy.body).toContain('CopyReferralLink');
    expect(ntfy.headers.Title).toBe('ViralRefer funnel');
  });
});