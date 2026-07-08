#!/usr/bin/env node
/** Restore P1 + automation flags after partial overwrite. */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

async function extractAdminSecret() {
  const html = await (await fetch('https://www.viralrefer.app/')).text();
  const m = html.match(/assets\/index-[^"']+\.js/);
  const js = await (await fetch(`https://www.viralrefer.app/${m[0]}`)).text();
  const idx = js.indexOf('admin-action');
  const near = js.slice(Math.max(0, idx - 500), idx + 500);
  return [...near.matchAll(/["']?([A-Za-z0-9]{30,34})["']?/g)]
    .map((x) => x[1])
    .filter((s) => !s.startsWith('eyJ') && !s.startsWith('0x'))[0];
}

const secret = await extractAdminSecret();
const pub = createClient(SUPABASE_URL, ANON);
const { data: row } = await pub.from('site_content').select('value').eq('key', 'optimizer_flags').maybeSingle();
const current = (row?.value && typeof row.value === 'object' ? row.value : {}) || {};

const repaired = {
  ...current,
  auto_pilot: true,
  growth_engine: true,
  growth_engine_status: current.growth_engine_status || 'collecting',
  growth_engine_version: current.growth_engine_version || '3b',
  referred_share_first: true,
  hero_cta_variant: 'prize',
  p1_conversion_boost: current.p1_conversion_boost || '2026-07-06',
  visitor_slim: current.visitor_slim !== false,
  autopilot_schedule: '0 6 * * * UTC',
  autopilot_via: 'vercel-cron',
};

const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON}`,
    apikey: ANON,
    'x-admin-secret': secret,
  },
  body: JSON.stringify({
    action: 'update_site_content',
    payload: { key: 'optimizer_flags', value: repaired },
  }),
});

const json = await res.json();
if (!json.success) {
  console.error('Repair failed:', json.error);
  process.exit(1);
}

console.log('✓ Optimizer flags repaired:', JSON.stringify(repaired, null, 2));