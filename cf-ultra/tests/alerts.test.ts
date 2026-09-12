import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAlertMessage,
  defaultAlertPrefs,
  emitAlert,
  emitJoinAlerts,
  flushAlertBatches,
  inQuietHours,
  maskWebhookUrl,
  maybeFirstShareAlert,
  normalizeAlertPrefs,
  parseAlertPrefsBody,
  pendingBatchCount,
  readAlertInbox,
  resetAlertRuntime,
  sanitizeWebhookUrl,
  shouldSendImmediate,
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
