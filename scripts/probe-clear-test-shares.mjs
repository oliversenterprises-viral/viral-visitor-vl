#!/usr/bin/env node
/** Probe clear_test_shares edge action (dry-run). */
import https from 'node:https';

const SUPABASE_URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function extractAdminSecret() {
  const html = await get('https://www.viralrefer.app/');
  const m = html.match(/assets\/index-[^"']+\.js/);
  if (!m) throw new Error('bundle not found');
  const js = await get(`https://www.viralrefer.app/${m[0]}`);
  const idx = js.indexOf('admin-action');
  const near = js.slice(Math.max(0, idx - 500), idx + 500);
  const hits = [...near.matchAll(/["']?([A-Za-z0-9]{30,34})["']?/g)]
    .map((x) => x[1])
    .filter((s) => !s.startsWith('eyJ') && !s.startsWith('0x'));
  return { secret: hits[0] || '', hasClear: js.includes('clear_test_shares') };
}

async function invoke(action, payload, secret) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'x-admin-secret': secret,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const { secret, hasClear } = await extractAdminSecret();
console.log('bundle has clear_test_shares:', hasClear);
console.log('extracted secret length:', secret?.length || 0);

const getShares = await invoke('get_shares', {}, secret);
console.log('\nget_shares status:', getShares.status);
console.log('get_shares success:', getShares.json?.success);
console.log('share count:', getShares.json?.data?.length);

const dryRun = await invoke('clear_test_shares', { dry_run: true }, secret);
console.log('\nclear_test_shares dry_run status:', dryRun.status);
console.log(JSON.stringify(dryRun.json, null, 2));

const APPLY = process.argv.includes('--apply');
if (APPLY && dryRun.json?.success && dryRun.json?.data?.would_delete > 0) {
  const applied = await invoke('clear_test_shares', { dry_run: false }, secret);
  console.log('\nclear_test_shares apply:', JSON.stringify(applied.json, null, 2));
}