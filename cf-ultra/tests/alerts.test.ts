import { afterEach, describe, expect, it } from 'vitest';
import {
  OWNER_TELEGRAM_CHAT_ID,
  buildAlertMessage,
  buildTelegramHtml,
  defaultAlertPrefs,
  deliverTelegram,
  emitAlert,
  clearAlertInbox,
  emitJoinAlerts,
  flushAlertBatches,
  inQuietHours,
  maskTelegramChatId,
  maskWebhookUrl,
  maybeFirstShareAlert,
  normalizeAlertPrefs,
  parseAlertPrefsBody,
  pendingBatchCount,
  readAlertInbox,
  resetAlertRuntime,
  sanitizeWebhookUrl,
  shouldSendImmediate,
  telegramChatId,
  telegramConfigured,
  testAlert,
} from '../functions/_lib/alerts';
import type { UltraEnv } from '../functions/_lib/store';

afterEach(() => {
  resetAlertRuntime();
});

const emptyEnv: UltraEnv = {};

describe('alert prefs', () => {
  it('defaults high-signal events on and digest off', () => {
    const p = defaultAlertPrefs();
    expect(p.events.race_started).toBe(true);
    expect(p.events.credit).toBe(true);
    expect(p.events.rung_banner).toBe(true);
    expect(p.events.spike).toBe(true);
    expect(p.digest).toBe('off');
    expect(p.events.digest).toBe(false);
    expect(p.telegram).toBe(true);
  });

  it('normalizes junk without inventing a webhook', () => {
    const p = normalizeAlertPrefs({ events: { credit: false, nope: true }, webhookUrl: 'ftp://x', digest: 'weekly' });
    expect(p.events.credit).toBe(false);
    expect(p.events.race_started).toBe(true);
    expect(p.webhookUrl).toBe('');
    expect(p.digest).toBe('off');
  });

  it('keeps the stored webhook when the admin posts a masked value', () => {
    const current = defaultAlertPrefs();
    current.webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxxsecret';
    const next = parseAlertPrefsBody({ webhookUrl: 'https://hooks.slack.com/…/xxx' }, current);
    expect(next.webhookUrl).toBe(current.webhookUrl);
  });
});

describe('quiet hours + immediate vs batch', () => {
  it('wraps overnight quiet hours', () => {
    const prefs = defaultAlertPrefs();
    prefs.quietHours = { enabled: true, startHour: 22, endHour: 8, tzOffsetMinutes: 0 };
    expect(inQuietHours(prefs, Date.parse('2026-09-12T23:00:00Z'))).toBe(true);
    expect(inQuietHours(prefs, Date.parse('2026-09-12T07:00:00Z'))).toBe(true);
    expect(inQuietHours(prefs, Date.parse('2026-09-12T15:00:00Z'))).toBe(false);
  });

  it('sends first three credits immediately and batches the rest', () => {
    expect(shouldSendImmediate('credit', 1)).toBe(true);
    expect(shouldSendImmediate('credit', 3)).toBe(true);
    expect(shouldSendImmediate('credit', 4, false)).toBe(false);
    expect(shouldSendImmediate('friend_land', 1)).toBe(false);
    expect(shouldSendImmediate('spike', 12)).toBe(false);
    expect(shouldSendImmediate('race_started', 1)).toBe(true);
  });
});

describe('webhook helpers', () => {
  it('masks secrets and rejects non-https', () => {
    expect(sanitizeWebhookUrl('http://evil.example/hook')).toBe('');
    expect(sanitizeWebhookUrl('https://discord.com/api/webhooks/1/secret-token')).toContain('discord.com');
    expect(maskWebhookUrl('https://discord.com/api/webhooks/1/secret-token')).toContain('…');
    expect(maskWebhookUrl('https://discord.com/api/webhooks/1/secret-token')).not.toContain('secret-token');
  });

  it('builds an admin deep link in the payload', () => {
    const text = buildAlertMessage({
      title: 'Credit #1',
      body: 'example.com: 1st verified credit — on the board.',
      host: 'example.com',
      count: 1,
      adminUrl: 'https://demo.example/admin/?focus=credit&host=example.com',
    });
    expect(text).toContain('https://demo.example/admin/?focus=credit&host=example.com');
    expect(text).toContain('example.com');
  });
});

describe('inbox + batching (no webhook)', () => {
  it('logs a new race to the inbox without a webhook secret', async () => {
    await emitJoinAlerts({
      env: emptyEnv,
      origin: 'http://localhost:8788',
      host: 'pastelab.com',
      isNewSite: true,
      credited: false,
      creditN: 0,
      previousRung: 'entered',
      nextRung: 'entered',
    });
    const inbox = await readAlertInbox(emptyEnv);
    expect(inbox[0]?.kind).toBe('race_started');
    expect(inbox[0]?.adminPath).toContain('/admin/?focus=race_started');
    expect(inbox[0]?.delivered).toBe('inbox');
  });

  it('clears the inbox and the KV key', async () => {
    const store = new Map<string, string>();
    const env = {
      BOARD: {
        async get(key: string, type?: string) {
          const v = store.get(key);
          if (v == null) return null;
          return type === 'json' ? JSON.parse(v) : v;
        },
        async put(key: string, value: string) {
          store.set(key, value);
        },
      },
    } as unknown as UltraEnv;
    await emitJoinAlerts({
      env,
      origin: 'http://localhost:8788',
      host: 'wipe-inbox.test',
      isNewSite: true,
      credited: false,
      creditN: 0,
      previousRung: 'entered',
      nextRung: 'entered',
    });
    expect((await readAlertInbox(env)).length).toBeGreaterThan(0);
    const result = await clearAlertInbox(env);
    expect(result.cleared).toBeGreaterThan(0);
    expect(await readAlertInbox(env)).toEqual([]);
    expect(JSON.parse(store.get('ultra:alert-inbox') || 'null')).toEqual([]);
  });

  it('batches friend lands until flush', async () => {
    for (let i = 0; i < 3; i++) {
      await emitAlert(emptyEnv, 'http://localhost:8788', {
        kind: 'friend_land',
        title: 'Friend land',
        body: 'via referral',
        host: 'boost.com',
        count: 1,
      });
    }
    expect(pendingBatchCount()).toBe(1);
    expect(await readAlertInbox(emptyEnv)).toHaveLength(0);
    await flushAlertBatches(emptyEnv, 'http://localhost:8788', true);
    const inbox = await readAlertInbox(emptyEnv);
    expect(inbox[0]?.count).toBe(3);
    expect(inbox[0]?.title).toMatch(/×3/);
  });

  it('dedupes first share per host', async () => {
    await maybeFirstShareAlert(emptyEnv, 'http://localhost:8788', 'once.com');
    await maybeFirstShareAlert(emptyEnv, 'http://localhost:8788', 'once.com');
    const inbox = await readAlertInbox(emptyEnv);
    expect(inbox.filter((i) => i.kind === 'first_share')).toHaveLength(1);
  });

  it('pings 1st credit immediately and batches later credits', async () => {
    await emitJoinAlerts({
      env: emptyEnv,
      origin: 'http://localhost:8788',
      host: 'friend.com',
      isNewSite: false,
      credited: true,
      creditN: 1,
      creditHost: 'climber.com',
      previousRung: 'entered',
      nextRung: 'rising',
    });
    let inbox = await readAlertInbox(emptyEnv);
    expect(inbox.some((i) => i.kind === 'credit' && i.title === 'Credit #1')).toBe(true);
    expect(inbox.some((i) => i.kind === 'rung_rising')).toBe(true);

    await emitJoinAlerts({
      env: emptyEnv,
      origin: 'http://localhost:8788',
      host: 'friend.com',
      isNewSite: false,
      credited: true,
      creditN: 9,
      creditHost: 'climber.com',
      previousRung: 'challenger',
      nextRung: 'challenger',
    });
    expect(pendingBatchCount()).toBe(1);
    inbox = await readAlertInbox(emptyEnv);
    expect(inbox.filter((i) => i.kind === 'credit')).toHaveLength(1);
  });
});

describe('Telegram owner channel', () => {
  it('documents this deploy’s chat id and never treats it as a token', () => {
    expect(OWNER_TELEGRAM_CHAT_ID).toBe('1274269043');
    expect(maskTelegramChatId(OWNER_TELEGRAM_CHAT_ID)).toBe('…043');
    expect(maskTelegramChatId(OWNER_TELEGRAM_CHAT_ID)).not.toContain('1274269043');
    expect(telegramChatId({})).toBe('1274269043');
    expect(telegramConfigured({})).toBe(false);
    expect(telegramConfigured({ TELEGRAM_BOT_TOKEN: 'x:token' })).toBe(true);
  });

  it('builds a short HTML ping with funnel step + HQ link', () => {
    const html = buildTelegramHtml({
      kind: 'credit',
      title: 'Credit #1',
      body: 'climber.com: 1st verified credit — on the board.',
      host: 'climber.com',
      count: 1,
      adminUrl: 'https://demo.example/admin/?focus=credit&host=climber.com',
    });
    expect(html).toContain('<b>Credit #1</b>');
    expect(html).toContain('Step: Credit');
    expect(html).toContain('Open HQ');
    expect(html).toContain('https://demo.example/admin/?focus=credit&amp;host=climber.com');
    expect(html).not.toContain('<script');
    expect(buildTelegramHtml({
      kind: 'rung_banner',
      title: 'x <y>',
      body: 'a&b',
      count: 2,
      adminUrl: 'https://x.test/admin/',
    })).toContain('x &lt;y&gt;');
  });

  it('stays inbox-only when Telegram secrets are missing', async () => {
    const item = await testAlert(emptyEnv, 'http://localhost:8788');
    expect(item.delivered).toBe('inbox');
    expect(item.body).toMatch(/inbox/i);
  });

  it('POSTs sendMessage to the configured chat and never uses VITE_', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const env: UltraEnv = { TELEGRAM_BOT_TOKEN: '123456:TESTTOKEN' };
      const sent = await deliverTelegram(
        env,
        buildTelegramHtml({
          kind: 'rung_banner',
          title: '#1 banner claim',
          body: 'hud-demo.test is the weekly lead.',
          host: 'hud-demo.test',
          count: 1,
          adminUrl: 'https://demo.example/admin/?focus=rung_banner',
        }),
      );
      expect(sent.ok).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://api.telegram.org/bot123456:TESTTOKEN/sendMessage');
      expect(calls[0].url).not.toContain('VITE_');
      expect(calls[0].body.chat_id).toBe('1274269043');
      expect(calls[0].body.parse_mode).toBe('HTML');
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('can turn Telegram off from HQ prefs', () => {
    const next = parseAlertPrefsBody({ telegram: false }, defaultAlertPrefs());
    expect(next.telegram).toBe(false);
  });
});
