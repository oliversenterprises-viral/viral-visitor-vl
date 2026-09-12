import { requireAdmin } from '../../_lib/admin-auth';
import { readAllTime, readDays } from '../../_lib/analytics';
import { daysBack, mergeBuckets } from '../../_lib/stats';
import { loadState, type UltraEnv } from '../../_lib/store';

function csv(rows: string[][]): Response {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="ultra-admin.csv"',
      'cache-control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  const table = new URL(request.url).searchParams.get('table') || 'daily';
  const range = new URL(request.url).searchParams.get('range') || '30d';
  const days = await readDays(env, daysBack(range));

  if (table === 'funnel') {
    const w = mergeBuckets(...days);
    return csv([
      ['step', 'count'],
      ['pageviews', String(w.pageviews)],
      ['lands', String(w.lands)],
      ['pastes', String(w.pastes)],
      ['joins', String(w.joins)],
      ['shares', String(w.shares)],
      ['friend_lands', String(w.friendLands)],
      ['credits', String(w.credits)],
    ]);
  }
  if (table === 'sites') {
    const { state } = await loadState(env);
    return csv([
      ['host', 'credits', 'owner'],
      ...Object.values(state.sites).map((s) => [s.host, String(s.creditTimes.length), s.ownerCode]),
    ]);
  }
  if (table === 'sharers') {
    const { state } = await loadState(env);
    return csv([
      ['code', 'host', 'credits', 'streak'],
      ...Object.values(state.players).map((p) => [p.code, p.siteHost, String(p.creditTimes.length), String(p.streakDays)]),
    ]);
  }
  if (table === 'all') {
    const all = await readAllTime(env);
    return csv([
      ['metric', 'value'],
      ...(['pageviews', 'uniques', 'joins', 'shares', 'credits', 'embedLoads'] as const).map((k) => [k, String(all[k])]),
    ]);
  }
  return csv([
    ['day', 'uniques', 'pageviews', 'lands', 'joins', 'shares', 'credits'],
    ...days.map((d) => [d.hour, String(d.uniques), String(d.pageviews), String(d.lands), String(d.joins), String(d.shares), String(d.credits)]),
  ]);
};
