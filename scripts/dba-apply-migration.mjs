#!/usr/bin/env node
/**
 * DBA — apply a single migration SQL file to linked Supabase (safe alternative to db push).
 *
 *   node scripts/dba-apply-migration.mjs 0016_shares_ab_variant.sql
 *   node scripts/dba-apply-migration.mjs --dry-run 0017_example.sql
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS = resolve(ROOT, 'supabase/migrations');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find((a) => !a.startsWith('--'));

if (!fileArg) {
  console.error('Usage: node scripts/dba-apply-migration.mjs [--dry-run] <migration-file.sql>');
  process.exit(1);
}

const sqlPath = fileArg.includes('/') || fileArg.includes('\\')
  ? resolve(ROOT, fileArg)
  : resolve(MIGRATIONS, fileArg.endsWith('.sql') ? fileArg : `${fileArg}.sql`);

if (!existsSync(sqlPath)) {
  console.error(`Migration not found: ${sqlPath}`);
  process.exit(1);
}

console.log(`=== DBA apply migration ${dryRun ? '(DRY RUN) ' : ''}===`);
console.log(`File: ${basename(sqlPath)}`);

if (dryRun) {
  console.log(`Would run: npx supabase db query --linked -f ${sqlPath}`);
  process.exit(0);
}

execSync(`npx supabase db query --linked -f "${sqlPath}"`, {
  stdio: 'inherit',
  cwd: ROOT,
});

console.log('\nMigration applied via supabase db query --linked');