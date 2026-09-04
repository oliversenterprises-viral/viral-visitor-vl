import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildBroadcastClickNotifyText,
  buildFunnelNotifyPayload,
  buildFunnelNotifyText,
  buildTelegramNotifyRequest,
  getFunnelNotifyChannel,
  getOwnerDeskTelegramStatus,
  dispatchBroadcastClickNotify,
  dispatchOutboundSiteClickNotify,
  dispatchSiteAddedNotify,
  isBroadcastClickNotifyEnabled,
  isBroadcastClickZone,
  isOutboundSiteClickNotifyEnabled,
  isOutboundSiteClickZone,
  isAddedSiteUrl,
  buildOutboundSiteClickNotifyText,
  buildSiteAddedNotifyText,
  buildPromoterSignupNotifyText,
  isFunnelOffsiteNotifyEnabled,
  isImportantFunnelNotifyStep,
  shouldNotifyFunnelEvent,
} from '../../supabase/functions/_shared/funnel-notify';

describe('funnel-notify', () => {
  const prevUrl = process.env.FUNNEL_NOTIFY_WEBHOOK_URL;
  const prevToken = process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID;
  const prevImportant = process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY;
  const prevBc = process.env.FUNNEL_NOTIFY_BROADCAST_CLICKS;
  const prevSite = process.env.FUNNEL_NOTIFY_SITE_CLICKS;

  beforeEach(() => {
    delete process.env.FUNNEL_NOTIFY_WEBHOOK_URL;
    delete process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
    delete process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID;
    delete process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY;
    delete process.env.FUNNEL_NOTIFY_BROADCAST_CLICKS;
    delete process.env.FUNNEL_NOTIFY_SITE_CLICKS;
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
    if (prevBc === undefined) delete process.env.FUNNEL_NOTIFY_BROADCAST_CLICKS;
    else process.env.FUNNEL_NOTIFY_BROADCAST_CLICKS = prevBc;
    if (prevSite === undefined) delete process.env.FUNNEL_NOTIFY_SITE_CLICKS;
    else process.env.FUNNEL_NOTIFY_SITE_CLICKS = prevSite;
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
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'GetReferralLink',
        ref_code: 'VIRAL-97UWEGZ',
        metadata: { user_agent: 'Mozilla/5.0 HeadlessChrome/131' },
      }),
    ).toBe(false);
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'GetReferralLink',
        ref_code: 'VIRAL-97UWEGZ',
        metadata: { user_agent: 'Mozilla/5.0 Chrome', webdriver: true },
      }),
    ).toBe(false);
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'GetReferralLink',
        ref_code: 'VIRAL-97UWEGZ',
      }),
    ).toBe(false);
  });

  it('shouldNotifyFunnelEvent defaults to important steps only', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'SiteLanding',
        metadata: { user_agent: 'Mozilla/5.0 Chrome' },
      }),
    ).toBe(false);
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'GetReferralLink',
        ref_code: 'VIRAL-ABC',
        metadata: { user_agent: 'Mozilla/5.0 Chrome' },
      }),
    ).toBe(true);
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'ShareReferral',
        metadata: { user_agent: 'Mozilla/5.0 Chrome' },
      }),
    ).toBe(true);
  });

  it('shouldNotifyFunnelEvent can alert every recorded step when important-only is off', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    process.env.FUNNEL_NOTIFY_IMPORTANT_ONLY = 'false';
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'SiteLanding',
        metadata: { user_agent: 'Mozilla/5.0 Chrome' },
      }),
    ).toBe(true);
    expect(
      shouldNotifyFunnelEvent({
        event_name: 'ShareReferral',
        metadata: { user_agent: 'Mozilla/5.0 Chrome' },
      }),
    ).toBe(true);
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

  it('buildPromoterSignupNotifyText names the new promoter', () => {
    const text = buildPromoterSignupNotifyText({
      name: 'Maya',
      code: 'MAYA',
      link: 'https://www.viralrefer.app/a/MAYA',
    });
    expect(text).toContain('New promoter');
    expect(text).toContain('Maya');
    expect(text).toContain('MAYA');
    expect(text).toContain('/a/MAYA');
  });

  it('isBroadcastClickZone matches broadcaster zones only', () => {
    expect(isBroadcastClickZone('owner-broadcast-link')).toBe(true);
    expect(isBroadcastClickZone('owner-broadcast-sponsor')).toBe(true);
    expect(isBroadcastClickZone('hero-get-link')).toBe(false);
  });

  it('isBroadcastClickNotifyEnabled uses same Telegram secrets', () => {
    expect(isBroadcastClickNotifyEnabled()).toBe(false);
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(isBroadcastClickNotifyEnabled()).toBe(true);
    process.env.FUNNEL_NOTIFY_BROADCAST_CLICKS = 'false';
    expect(isBroadcastClickNotifyEnabled()).toBe(false);
  });

  it('skips broadcast Telegram for agent browsers', async () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    const skipped = await dispatchBroadcastClickNotify({
      zone_id: 'owner-broadcast-link',
      href: 'https://example.com',
      user_agent: 'Mozilla/5.0 HeadlessChrome/131',
    });
    expect(skipped.skipped).toBe('agent');
    const empty = await dispatchBroadcastClickNotify({
      zone_id: 'owner-broadcast-link',
      href: 'https://example.com',
    });
    expect(empty.skipped).toBe('agent');
  });

  it('buildBroadcastClickNotifyText includes kind and href', () => {
    const text = buildBroadcastClickNotifyText({
      zone_id: 'owner-broadcast-sponsor',
      href: 'https://example.com/offer',
      label: 'Partner',
      broadcast_id: 'rules-v1',
    });
    expect(text).toContain('Sponsor CTA');
    expect(text).toContain('https://example.com/offer');
    expect(text).toContain('Partner');
    expect(text).toContain('id:rules-v1');
  });

  it('isOutboundSiteClickZone matches homepage site/banner zones only', () => {
    expect(isOutboundSiteClickZone('prize-banner')).toBe(true);
    expect(isOutboundSiteClickZone('site-drop')).toBe(true);
    expect(isOutboundSiteClickZone('race-text-spot')).toBe(true);
    expect(isOutboundSiteClickZone('owner-featured')).toBe(true);
    expect(isOutboundSiteClickZone('hero-get-link')).toBe(false);
    expect(isOutboundSiteClickZone('owner-broadcast-link')).toBe(false);
  });

  it('isOutboundSiteClickNotifyEnabled uses same Telegram secrets', () => {
    expect(isOutboundSiteClickNotifyEnabled()).toBe(false);
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(isOutboundSiteClickNotifyEnabled()).toBe(true);
    process.env.FUNNEL_NOTIFY_SITE_CLICKS = 'false';
    expect(isOutboundSiteClickNotifyEnabled()).toBe(false);
  });

  it('skips outbound site Telegram without http href or for agents', async () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    const noHref = await dispatchOutboundSiteClickNotify({
      zone_id: 'prize-banner',
      user_agent: 'Mozilla/5.0',
    });
    expect(noHref.skipped).toBe('no_href');
    const agent = await dispatchOutboundSiteClickNotify({
      zone_id: 'site-drop',
      href: 'https://example.com',
      user_agent: 'Mozilla/5.0 HeadlessChrome/131',
    });
    expect(agent.skipped).toBe('agent');
  });

  it('buildSiteAddedNotifyText names the slot, code, and url', () => {
    const text = buildSiteAddedNotifyText({
      kind: 'entered',
      code: 'VIRAL-SITE1',
      url: 'https://northwind.test',
      label: 'Northwind',
    });
    expect(text).toContain('Site added. Just entered (15 min).');
    expect(text).toContain('VIRAL-SITE1');
    expect(text).toContain('https://northwind.test');
    expect(text).toContain('Northwind');
    expect(
      buildSiteAddedNotifyText({
        kind: 'banner',
        code: 'VIRAL-WIN',
        url: 'https://winner.test',
      }),
    ).toContain('7-day prize banner');
  });

  it('dispatchSiteAddedNotify skips placeholder /r/ race pages', async () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    expect(isAddedSiteUrl('https://www.viralrefer.app/r/VIRAL-SITE1')).toBe(false);
    expect(isAddedSiteUrl('https://northwind.test')).toBe(true);
    const skipped = await dispatchSiteAddedNotify({
      kind: 'entered',
      code: 'VIRAL-SITE1',
      url: 'https://www.viralrefer.app/r/VIRAL-SITE1',
    });
    expect(skipped.skipped).toBe('not_a_site');
  });

  it('buildOutboundSiteClickNotifyText names the surface and href', () => {
    const text = buildOutboundSiteClickNotifyText({
      zone_id: 'prize-banner',
      href: 'https://northwind.test',
      label: 'Northwind',
    });
    expect(text).toContain('Site click. Prize banner.');
    expect(text).toContain('https://northwind.test');
    expect(text).toContain('Northwind');
  });

  it('HQ telegram status never includes secrets', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.FUNNEL_NOTIFY_TELEGRAM_CHAT_ID = '999';
    const status = getOwnerDeskTelegramStatus();
    expect(status).toEqual({ connected: true, importantOnly: true });
    expect(JSON.stringify(status)).not.toMatch(/123:abc|999/);
  });
});