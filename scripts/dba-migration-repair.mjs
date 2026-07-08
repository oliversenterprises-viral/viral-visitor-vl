#!/usr/bin/env node
/**
 * DBA — print supabase migration repair commands for migrations already applied in prod.
 * Use when `supabase db push` tries to re-apply 0001_init_rls.sql on an existing database.
 *
 *   node scripts/dba-migration-repair.mjs           # print repair commands
 *   node scripts/dba-migration-repair.mjs --apply   # run repair (marks all local migrations applied)
 */

import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

const apply = process.argv.includes('--apply');

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const versions = files.map((f) => f.replace(/\.sql$/, ''));

console.log('=== DBA migration history repair ===');
console.log(`Found ${versions.length} local migration(s).\n`);

for (const version of versions) {
  const cmd = `npx supabase migration repair --status applied ${version}`;
  if (apply) {
    console.log(`>>> ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    } catch (err) {
      console.warn(`Repair failed for ${version} (may already be recorded):`, err.message || err);
    }
  } else {
    console.log(cmd);
  }
}

if (!apply) {
  console.log('\nDry run — re-run with --apply to mark all as applied on linked project.');
  console.log('For new migrations only, prefer: node scripts/dba-apply-migration.mjs <file.sql>');
}