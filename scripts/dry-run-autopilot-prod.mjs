#!/usr/bin/env node
/** Dry-run growth engine / autopilot against production (read-only flags). */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

async function extractAdminSecret() {
  const envSecret =
    process.env.ADMIN_ACTION_SECRET ||
    process.env.VITE_ADMIN_ACTION_SECRET ||
    process.env.OPTIMIZER_CRON_SECRET;
  if (envSecret) return envSecret;

  const html = await (await fetch('https://www.viralrefer.app/')).text();
  const m = html.match(/assets\/index-[^"']+\.js/);
  if (!m) throw new Error('bundle not found');
  const js = await (await fetch(`https://www.viralrefer.app/${m[0]}`)).text();
  const idx = js.indexOf('admin-action');
  const near = js.slice(Math.max(0, idx - 500), idx + 500);
  const hits = [...near.matchAll(/["']?([A-Za-z0-9]{30,34})["']?/g)]
    .map((x) => x[1])
    .filter((s) => !s.startsWith('eyJ') && !s.startsWith('0x'));
  return hits[0] || '';
}

const secret = await extractAdminSecret();
if (!secret) {
  console.error('Could not resolve admin secret');
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON}`,
    apikey: ANON,
    'x-admin-secret': secret,
  },
  body: JSON.stringify({ action: 'run_optimizer_autopilot', payload: { dry_run: true } }),
});

const json = await res.json();
const outPath = resolve(ROOT, '.dry-run-autopilot-result.json');
writeFileSync(outPath, JSON.stringify(json, null, 2));

if (!json.success) {
  console.error('Dry run failed:', json.error || res.status);
  process.exit(1);
}

const { decision, cycle, flagsBefore } = json.data || {};
const health = cycle?.health;

console.log('=== Growth Engine Dry Run (production) ===\n');
console.log('Engine status:', cycle?.engineStatus || flagsBefore?.growth_engine_status || '—');
console.log('K-score:', health?.kScore?.toFixed(3) ?? flagsBefore?.growth_engine_k_score ?? '—');
console.log('\nFunnel health (unique visitors):');
if (health) {
  console.log(`  Landings: ${health.landings}`);
  console.log(`  Get link: ${health.getLink} (${(health.getLinkRate * 100).toFixed(0)}% of landings)`);
  console.log(`  Share after get-link: ${health.shares}/${health.getLink} (${(health.shareAfterGetLinkRate * 100).toFixed(0)}%)`);
  console.log(`  Referred landings: ${health.referredLandings}`);
  console.log(`  Referred get-link: ${health.referredGetLink} (${(health.referredGetLinkRate * 100).toFixed(0)}%)`);
  console.log(`  Referrals/share: ${health.referralsPerShare?.toFixed(2) ?? '—'}`);
}
console.log('\nA/B decision:', cycle?.abDecision?.reason || '—');
console.log('\nFinal decision:', decision?.action || 'none');
console.log('Reason:', decision?.reason || '—');
console.log('Would update flags:', decision?.wouldUpdateFlags ? 'YES' : 'no');
console.log('\nFlags before:');
console.log(`  auto_pilot: ${flagsBefore?.auto_pilot}`);
console.log(`  growth_engine: ${flagsBefore?.growth_engine}`);
console.log(`  share_ab_default: ${flagsBefore?.share_ab_default ?? 'split'}`);
console.log(`  referred_share_first: ${flagsBefore?.referred_share_first ?? false}`);

try {
  unlinkSync(outPath);
} catch {
  /* ignore */
}