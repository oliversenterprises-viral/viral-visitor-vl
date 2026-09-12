import { requireAdmin } from '../../_lib/admin-auth';
import {
  alertPublicView,
  clearAlertInbox,
  loadAlertPrefs,
  parseAlertPrefsBody,
  readAlertInbox,
  saveAlertPrefs,
  testAlert,
} from '../../_lib/alerts';
import { purgeFeedByIp, resetAnalytics } from '../../_lib/analytics';
import { addExcludeIp, loadExcludeIps, removeExcludeIp } from '../../_lib/exclude';
import { createEmptyState } from '../../_lib/engine';
import { json, originFromRequest, readJson } from '../../_lib/http';
import { DEFAULT_OPS, loadOps, saveOps } from '../../_lib/ops';
import { saveState, type UltraEnv } from '../../_lib/store';

type Body = {
  op?: string;
  code?: string;
  site?: string;
  hero?: string;
  lead?: string;
  ip?: string;
  purge?: boolean;
  events?: Record<string, boolean>;
  webhookUrl?: string | null;
  telegram?: boolean;
  quietHours?: { enabled?: boolean; startHour?: number; endHour?: number; tzOffsetMinutes?: number };
  digest?: 'off' | 'hourly' | 'daily';
  teCreditsCount?: boolean;
};

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  const body = (await readJson<Body>(request)) ?? {};
  const ops = await loadOps(env);
  const op = body.op || '';
  const origin = originFromRequest(request);

  if (op === 'save_alerts') {
    const current = await loadAlertPrefs(env);
    const next = parseAlertPrefsBody(body, current);
    if (env.NOTIFY_WEBHOOK_URL) next.webhookUrl = current.webhookUrl;
    const prefs = await saveAlertPrefs(env, next);
    const inbox = await readAlertInbox(env);
    return json({ ok: true, op, alerts: alertPublicView(env, prefs, inbox) });
  }
  if (op === 'test_alert') {
    const item = await testAlert(env, origin);
    const prefs = await loadAlertPrefs(env);
    const inbox = await readAlertInbox(env);
    return json({ ok: true, op, item, alerts: alertPublicView(env, prefs, inbox) });
  }

  if (op === 'exclude_ip_add') {
    const result = await addExcludeIp(env, body.ip || '');
    if (result.error) return json({ ok: false, error: result.error, excludeIps: result.ips }, { status: 400 });
    const purged = body.purge && result.added ? await purgeFeedByIp(env, result.added) : 0;
    return json({ ok: true, op, excludeIps: result.ips, added: result.added, purged });
  }
  if (op === 'exclude_ip_remove') {
    const result = await removeExcludeIp(env, body.ip || '');
    return json({ ok: true, op, excludeIps: result.ips, removed: result.removed });
  }
  if (op === 'reset_stats') {
    const result = await resetAnalytics(env);
    return json({ ok: true, op, reset: 'stats', deleted: result.deleted, kv: true });
  }
  if (op === 'clear_inbox') {
    const result = await clearAlertInbox(env);
    const prefs = await loadAlertPrefs(env);
    const inbox = await readAlertInbox(env);
    return json({ ok: true, op, cleared: result.cleared, alerts: alertPublicView(env, prefs, inbox) });
  }

  if (op === 'ban_code' && body.code) {
    const c = body.code.toUpperCase();
    if (!ops.bannedCodes.includes(c)) ops.bannedCodes.push(c);
  } else if (op === 'ban_site' && body.site) {
    const h = body.site.toLowerCase();
    if (!ops.bannedSites.includes(h)) ops.bannedSites.push(h);
  } else if (op === 'mute_code' && body.code) {
    const c = body.code.toUpperCase();
    if (!ops.mutedCodes.includes(c)) ops.mutedCodes.push(c);
  } else if (op === 'unban' && body.code) {
    const c = body.code.toUpperCase();
    ops.bannedCodes = ops.bannedCodes.filter((x) => x !== c);
    ops.mutedCodes = ops.mutedCodes.filter((x) => x !== c);
  } else if (op === 'unban_site' && body.site) {
    const h = body.site.toLowerCase();
    ops.bannedSites = ops.bannedSites.filter((x) => x !== h);
  } else if (op === 'save_copy') {
    if (body.hero) ops.hero = body.hero.slice(0, 160);
    if (body.lead) ops.lead = body.lead.slice(0, 400);
  } else if (op === 'save_te') {
    ops.teCreditsCount = body.teCreditsCount === true;
  } else if (op === 'reset_demo') {
    await saveState(env, createEmptyState(), true);
    await saveOps(env, { ...DEFAULT_OPS });
    const excludeIps = await loadExcludeIps(env);
    return json({ ok: true, op, reset: 'board', excludeIps });
  } else {
    return json({ ok: false, error: 'Unknown op.' }, { status: 400 });
  }

  await saveOps(env, ops);
  return json({ ok: true, op, ops });
};
