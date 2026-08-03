#!/usr/bin/env node
/** Smoke: public anon RPC get_daily_crown_status (no secrets printed). */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(name) {
  try {
    const t = readFileSync(resolve(ROOT, name), 'utf8');
    const out = {};
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[m[1].trim()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv('.env.example'),
  ...loadEnv('.env.local'),
  ...loadEnv('.env.production.local'),
  ...loadEnv('.env.vercel.prod'),
};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('RPC_SMOKE FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/rpc/get_daily_crown_status`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_hall_days: 14 }),
});

const text = await res.text();
if (!res.ok) {
  console.error('RPC_SMOKE FAIL', res.status, text.slice(0, 240));
  process.exit(1);
}

const data = JSON.parse(text);
console.log(
  'RPC_SMOKE OK',
  JSON.stringify({
    today: data.today_utc,
    champ: data.yesterday_champion?.referrer_code ?? null,
    hall: Array.isArray(data.hall) ? data.hall.length : 0,
    secs: data.seconds_remaining,
  }),
);
