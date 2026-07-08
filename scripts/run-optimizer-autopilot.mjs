#!/usr/bin/env node
/**
 * Invoke optimizer-cron edge function (Phase 3a autopilot).
 *
 *   node scripts/run-optimizer-autopilot.mjs           # live run (if auto_pilot on)
 *   node scripts/run-optimizer-autopilot.mjs --dry-run
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (or service), ADMIN_ACTION_SECRET or OPTIMIZER_CRON_SECRET
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(ROOT, '.env.local'));
loadEnvFile(resolve(ROOT, '.env.production.local'));

const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const secret =
  process.env.OPTIMIZER_CRON_SECRET ||
  process.env.ADMIN_ACTION_SECRET ||
  process.env.VITE_ADMIN_ACTION_SECRET;

if (!supabaseUrl || !anonKey || !secret) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or ADMIN_ACTION_SECRET');
  process.exit(1);
}

const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/optimizer-cron`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
    'x-optimizer-cron-secret': secret,
  },
  body: JSON.stringify({ dry_run: dryRun }),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error('Non-JSON response:', text);
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));
if (!json.success) process.exit(1);

const reason = json.data?.decision?.reason;
console.log(`\nAutopilot ${dryRun ? '(dry run)' : ''}: ${reason || 'ok'}`);