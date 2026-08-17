#!/usr/bin/env node
/**
 * Apply local supabase/migrations/*.sql that are not yet recorded in
 * public.vr_applied_migrations. First run creates the table and seeds every
 * current filename as already applied (does not re-run 0001–0054).
 *
 *   node scripts/apply-pending-prod-migrations.mjs
 *   node scripts/apply-pending-prod-migrations.mjs --dry-run
 */
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS = resolve(ROOT, 'supabase/migrations');
const dryRun = process.argv.includes('--dry-run');

function query(sql) {
  return execSync(`npx supabase db query --linked -o json`, {
    cwd: ROOT,
    encoding: 'utf8',
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function applyFile(absPath) {
  execSync(`npx supabase db query --linked -f "${absPath}"`, {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true,
  });
}

const files = readdirSync(MIGRATIONS)
  .filter((name) => /^\d{4}_.+\.sql$/i.test(name))
  .sort();

const ensureSql = `
CREATE TABLE IF NOT EXISTS public.vr_applied_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.vr_applied_migrations FROM PUBLIC;
REVOKE ALL ON TABLE public.vr_applied_migrations FROM anon, authenticated;
GRANT ALL ON TABLE public.vr_applied_migrations TO service_role;
`;

console.log('=== Pending production migrations ===');
if (dryRun) {
  console.log(`Would ensure vr_applied_migrations and compare ${files.length} local files.`);
  process.exit(0);
}

query(ensureSql);

let applied = [];
try {
  const raw = query('SELECT name FROM public.vr_applied_migrations ORDER BY name;');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows || parsed?.data || [];
  applied = rows
    .map((row) => String(row.name || row.NAME || '').trim())
    .filter(Boolean);
} catch (err) {
  console.warn('Could not read vr_applied_migrations; treating as empty.', err?.message || err);
}

if (applied.length === 0) {
  console.log(`Seeding ${files.length} already-live migration names (no re-apply).`);
  const values = files.map((name) => `('${name.replace(/'/g, "''")}')`).join(',\n');
  query(`INSERT INTO public.vr_applied_migrations (name) VALUES ${values} ON CONFLICT (name) DO NOTHING;`);
  console.log('Seed complete. Next new supabase/migrations/*.sql will apply on deploy.');
  process.exit(0);
}

const pending = files.filter((name) => !applied.includes(name));
if (pending.length === 0) {
  console.log('No pending migrations.');
  process.exit(0);
}

for (const name of pending) {
  const abs = join(MIGRATIONS, name);
  console.log(`Applying ${name}`);
  applyFile(abs);
  query(
    `INSERT INTO public.vr_applied_migrations (name) VALUES ('${name.replace(/'/g, "''")}') ON CONFLICT (name) DO NOTHING;`,
  );
}

console.log(`Applied ${pending.length} migration(s).`);
