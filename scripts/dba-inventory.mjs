#!/usr/bin/env node
/**
 * Read-only production DBA inventory (policies, grants, table list).
 *   node scripts/dba-inventory.mjs
 */
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sql = `
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
  'referrals_rows', (SELECT count(*)::int FROM public.referrals)
);
`;

const tmp = resolve(ROOT, 'scripts/.dba-inventory-temp.sql');
writeFileSync(tmp, sql);
try {
  execSync(`npx supabase db query --linked -f "${tmp}"`, {
    encoding: 'utf8',
    cwd: ROOT,
    stdio: 'inherit',
  });
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    // non-fatal
  }
}