import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const INVENTORY_SQL = `
SELECT json_build_object(
  'tables', (
    SELECT json_agg(table_name ORDER BY table_name)
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ),
  'anon_select_grants', (
    SELECT COALESCE(json_agg(json_build_object('table', table_name, 'grantee', grantee) ORDER BY table_name), '[]'::json)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type = 'SELECT'
  ),
  'permissive_select_policies', (
    SELECT COALESCE(json_agg(json_build_object('table', tablename, 'policy', policyname, 'roles', roles::text) ORDER BY tablename), '[]'::json)
    FROM pg_policies
    WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual::text = 'true'
  ),
  'prize_claims_rows', (SELECT count(*)::int FROM public.prize_claims),
  'referrals_rows', (SELECT count(*)::int FROM public.referrals),
  'visitor_events_rows', (SELECT count(*)::int FROM public.visitor_events),
  'interaction_events_rows', (SELECT count(*)::int FROM public.interaction_events)
) AS inventory;
`;

export function fetchDbaInventory() {
  const tmp = resolve(ROOT, 'scripts/.dba-inventory-temp.sql');
  writeFileSync(tmp, INVENTORY_SQL);
  try {
    const raw = execSync(
      `npx supabase db query --linked -f "${tmp}" --output-format json`,
      { encoding: 'utf8', cwd: ROOT },
    );
    const parsed = JSON.parse(raw);
    const row = Array.isArray(parsed) ? parsed[0] : parsed?.rows?.[0] ?? parsed;
    const inventory = row?.inventory ?? row?.json_build_object ?? row;
    if (!inventory || typeof inventory !== 'object') {
      throw new Error('Could not parse inventory JSON from supabase db query');
    }
    return inventory;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // non-fatal
    }
  }
}

export function assessInventorySecurity(inventory) {
  const issues = [];
  const allowedAnonSelect = new Set(['site_content']);

  for (const grant of inventory.anon_select_grants || []) {
    if (!allowedAnonSelect.has(grant.table)) {
      issues.push(`Unexpected anon/authenticated SELECT grant on ${grant.table} (${grant.grantee})`);
    }
  }

  for (const policy of inventory.permissive_select_policies || []) {
    if (policy.table !== 'site_content') {
      issues.push(`Permissive SELECT policy on ${policy.table}: ${policy.policy}`);
    }
  }

  const siteContentPolicies = (inventory.permissive_select_policies || []).filter(
    (p) => p.table === 'site_content',
  );
  if (siteContentPolicies.length > 1) {
    issues.push(`Duplicate site_content SELECT policies (${siteContentPolicies.length})`);
  }

  return issues;
}