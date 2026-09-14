import { requireAdmin } from '../../_lib/admin-auth';
import { alertPublicView, loadAlertPrefs, readAlertInbox } from '../../_lib/alerts';
import { isolateBucket, liveVisitors, readAllTime, readDays, readFeed, readRungs } from '../../_lib/analytics';
import { loadExcludeIps } from '../../_lib/exclude';
import { weeklyCredits } from '../../_lib/engine';
import { json } from '../../_lib/http';
import { loadOps } from '../../_lib/ops';
import { daysBack, funnelRates, mergeBuckets, topMap, type HourBucket } from '../../_lib/stats';
import { getBoard, kvBound, loadState, type UltraEnv } from '../../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  const range = new URL(request.url).searchParams.get('range') || '7d';
  const days = daysBack(range);
  const [dayRows, all, feed, rungs, boardRead, loaded, ops, prefs, inbox, excludeIps] = await Promise.all([
    readDays(env, days),
    readAllTime(env),
    readFeed(env),
    readRungs(env),
    getBoard(env),
    loadState(env),
    loadOps(env),
    loadAlertPrefs(env),
    readAlertInbox(env),
    loadExcludeIps(env),
  ]);

  const window = range === 'all' ? all : mergeBuckets(...dayRows.map((d) => ({ ...d, hour: d.hour })));
  const today = dayRows[0] || isolateBucket();
  const series = [...dayRows].reverse().map((d) => ({
    day: d.hour,
    lands: d.lands,
    joins: d.joins,
    shares: d.shares,
    credits: d.credits,
    pageviews: d.pageviews,
    uniques: d.uniques,
  }));

  const players = Object.values(loaded.state.players);
  const sites = Object.values(loaded.state.sites);
  const topSharers = players
    .map((p) => ({
      code: p.code,
      host: p.siteHost,
      credits: p.creditTimes.length,
      streak: p.streakDays,
    }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 12);
  const topSites = sites
    .map((s) => ({ host: s.host, credits: s.creditTimes.length, owner: s.ownerCode }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 12);
  const now = Date.now();
  const codes = players
    .map((p) => ({
      code: p.code,
      host: p.siteHost || '',
      credits: p.creditTimes.length,
      weekly: weeklyCredits(p.creditTimes, now),
      referredBy: p.referredBy,
      createdAt: p.createdAt,
    }))
    .sort((a, b) => b.credits - a.credits || b.createdAt - a.createdAt)
    .slice(0, 40);

  const funnel = funnelRates(window as HourBucket);

  return json({
    ok: true,
    live: true,
    mock: false,
    range,
    kv: kvBound(env),
    liveVisitors: liveVisitors(),
    window,
    today,
    all,
    series,
    funnel,
    platforms: topMap(window.platforms, 10),
    referrers: topMap(window.referrers, 10),
    utm: topMap(window.utm, 10),
    geo: topMap(window.geo, 12),
    device: topMap(window.device, 4),
    browser: topMap(window.browser, 6),
    feed,
    rungs,
    board: boardRead.board,
    topSharers,
    topSites,
    codes,
    ops,
    excludeIps,
    camps: topMap(window.camps || {}, 8),
    srcs: topMap(window.srcs || {}, 12),
    te: {
      lands: window.teLands ?? 0,
      joins: window.teJoins ?? 0,
      ignored: window.teCreditsIgnored ?? 0,
      toJoin: funnel.teToJoin ?? 0,
      quality: funnel.teQuality ?? 0,
      splashViews: window.teSplashViews ?? 0,
      splashCtas: window.teSplashCtas ?? 0,
      splashToCta: funnel.splashToCta ?? 0,
      teCreditsCount: ops.teCreditsCount === true,
    },
    alerts: alertPublicView(env, prefs, inbox),
    health: {
      kv: kvBound(env),
      degraded: boardRead.degraded,
      cache: boardRead.cache,
      players: players.length,
      sites: sites.length,
      credits: Object.keys(loaded.state.credits).length,
      assumedPlan: 'Workers Paid + BOARD KV',
      writePolicy: 'Pageviews sampled + buffered. Joins/credits flush immediately. No write-per-pageview. Excluded IPs and Owner HQ sessions never increment counters.',
    },
  });
};
