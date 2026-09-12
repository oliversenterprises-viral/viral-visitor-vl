import { requireAdmin } from '../../_lib/admin-auth';
import {
  alertPublicView,
  loadAlertPrefs,
  parseAlertPrefsBody,
  readAlertInbox,
  saveAlertPrefs,
  testAlert,
} from '../../_lib/alerts';
import { resetAnalytics } from '../../_lib/analytics';
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
  events?: Record<string, boolean>;
  webhookUrl?: string | null;
  quietHours?: { enabled?: boolean; startHour?: number; endHour?: number; tzOffsetMinutes?: number };
  digest?: 'off' | 'hourly' | 'daily';
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
  } else if (op === 'reset_demo') {
    await saveState(env, createEmptyState(), true);
    await resetAnalytics(env);
    await saveOps(env, { ...DEFAULT_OPS });
    return json({ ok: true, op, reset: true });
  } else {
    return json({ ok: false, error: 'Unknown op.' }, { status: 400 });
  }

  await saveOps(env, ops);
  return json({ ok: true, op, ops });
};
