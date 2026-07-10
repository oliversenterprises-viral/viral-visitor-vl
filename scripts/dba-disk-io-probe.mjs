#!/usr/bin/env node
/**
 * Probe Disk IO pressure: table sizes, dead tuples, seq scans, bloat hints.
 * Read-only.
 */
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, unlinkSync } from 'fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function query(sql, label) {
  const tmp = resolve(ROOT, `.tmp-disk-io-${Date.now()}.sql`);
  writeFileSync(tmp, sql, 'utf8');
  try {
    console.log(`\n=== ${label} ===`);
    const out = execSync(`npx supabase db query --linked -f "${tmp}"`, {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 120000,
    });
    console.log(out.slice(0, 12000));
  } catch (e) {
    console.error(label, 'failed:', e.stdout || e.message);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

query(
  `
SELECT relname AS table_name,
       n_live_tup::bigint AS live_rows,
       n_dead_tup::bigint AS dead_rows,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
       seq_scan,
       idx_scan,
       n_tup_ins AS inserts,
       n_tup_upd AS updates,
       n_tup_del AS deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
LIMIT 25;
`,
  'Largest tables + dead tuples',
);

query(
  `
SELECT indexrelname AS index_name,
       relname AS table_name,
       idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
`,
  'Largest indexes',
);

query(
  `
SELECT
  (SELECT count(*) FROM public.visitor_events) AS visitor_events,
  (SELECT count(*) FROM public.banner_events) AS banner_events,
  (SELECT count(*) FROM public.interaction_events) AS interaction_events,
  (SELECT count(*) FROM public.referrals) AS referrals,
  (SELECT count(*) FROM public.shares) AS shares;
`,
  'Hot table row counts',
);

query(
  `
SELECT
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h,
  count(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d,
  count(*) AS total
FROM public.visitor_events;
`,
  'visitor_events growth',
);

query(
  `
SELECT event_name, count(*) AS n
FROM public.visitor_events
WHERE created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY n DESC
LIMIT 20;
`,
  'visitor_events by name (7d)',
);

query(
  `
SELECT
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h,
  count(*) AS total
FROM public.interaction_events;
`,
  'interaction_events growth',
);
