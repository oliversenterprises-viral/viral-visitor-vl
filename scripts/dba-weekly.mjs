#!/usr/bin/env node
/**
 * Weekly DBA cadence — inventory + stats snapshot + prod smoke in one run.
 *   npm run dba:weekly
 *   node scripts/dba-weekly.mjs --json
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { assessInventorySecurity, fetchDbaInventory } from './dba-inventory-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = process.argv.includes('--json');

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT });
}

function parseMigrationSync(output) {
  const lines = output.split('\n');
  const unsynced = [];
  for (const line of lines) {
    const m = line.match(/`(\d{4})`\s*\|\s*`([^`|]*)`/);
    if (!m) continue;
    const local = m[1];
    const remote = m[2].trim();
    if (!remote || remote !== local) {
      unsynced.push({ local, remote: remote || null });
    }
  }
  return { synced: unsynced.length === 0, unsynced };
}

function fetchStatsSnapshot() {
  const raw = runCapture('node scripts/dba-stats-snapshot.mjs');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Could not parse stats snapshot JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

function runSmoke() {
  try {
    const out = execSync('npm run test:smoke:prod', { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' });
    const match = out.match(/(\d+)\/(\d+) checks passed/);
    return {
      ok: true,
      passed: match ? Number(match[1]) : null,
      total: match ? Number(match[2]) : null,
    };
  } catch (err) {
    const out = `${err.stdout || ''}${err.stderr || ''}`;
    const match = out.match(/(\d+)\/(\d+) checks passed/);
    return {
      ok: false,
      passed: match ? Number(match[1]) : null,
      total: match ? Number(match[2]) : null,
      error: out.split('\n').slice(-5).join(' ').trim(),
    };
  }
}

console.log('=== DBA weekly cadence ===\n');

const at = new Date().toISOString();
const migrationsRaw = runCapture('npx supabase migration list --linked 2>&1');
const migrations = parseMigrationSync(migrationsRaw);
const inventory = fetchDbaInventory();
const securityIssues = assessInventorySecurity(inventory);
const stats = fetchStatsSnapshot();

console.log('>>> Running production smoke test...');
const smoke = runSmoke();

const report = {
  at,
  site: stats.site,
  migrations,
  inventory,
  securityIssues,
  stats,
  smoke,
  healthy: migrations.synced && securityIssues.length === 0 && smoke.ok,
};

const reportDir = resolve(ROOT, '.grok');
mkdirSync(reportDir, { recursive: true });
writeFileSync(resolve(reportDir, 'dba-weekly-latest.json'), `${JSON.stringify(report, null, 2)}\n`);

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\n--- Migration sync ---');
  console.log(migrations.synced ? 'OK — all local migrations applied remotely' : `ISSUES — ${migrations.unsynced.length} unsynced`);
  if (!migrations.synced) {
    for (const u of migrations.unsynced) console.log(`  - local ${u.local} remote ${u.remote ?? '(missing)'}`);
  }

  console.log('\n--- Security inventory ---');
  console.log(`Tables: ${(inventory.tables || []).length}`);
  console.log(`Anon SELECT grants: ${(inventory.anon_select_grants || []).map((g) => `${g.table}(${g.grantee})`).join(', ') || 'none'}`);
  console.log(`Permissive SELECT policies: ${(inventory.permissive_select_policies || []).length}`);
  if (securityIssues.length === 0) {
    console.log('OK — no unexpected public read surfaces');
  } else {
    for (const issue of securityIssues) console.log(`  ! ${issue}`);
  }

  console.log('\n--- Growth snapshot ---');
  console.log(`Referrals: ${stats.referrals?.total} total | ${stats.referrals?.yours} yours | rank #${stats.referrals?.rank ?? '?'}`);
  console.log(`Events: ${stats.allTime?.visitorEvents} visitor | ${stats.allTime?.siteLandings} landings`);
  console.log(`7d: ${stats.last7Days?.uniqueVisitorsSampled} unique visitors (sampled)`);

  console.log('\n--- Smoke ---');
  console.log(smoke.ok ? `OK — ${smoke.passed}/${smoke.total} passed` : `FAILED — ${smoke.passed}/${smoke.total} (${smoke.error || 'see output'})`);

  console.log(`\nReport saved: .grok/dba-weekly-latest.json`);
  console.log(report.healthy ? '\nDBA weekly: HEALTHY' : '\nDBA weekly: ATTENTION NEEDED');
}

if (!report.healthy) process.exit(1);