#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnvFile(name) {
  try {
    return readFileSync(resolve(root, name), 'utf8');
  } catch {
    return '';
  }
}
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const merged = {
  ...parseEnv(loadEnvFile('.env.example')),
  ...parseEnv(loadEnvFile('.env.local')),
  ...parseEnv(loadEnvFile('.env.production.local')),
  ...parseEnv(loadEnvFile('.env.vercel.prod')),
  ...parseEnv(loadEnvFile('.env.smoke.local')),
};
const url = merged.VITE_SUPABASE_URL || '';
const key = merged.VITE_SUPABASE_ANON_KEY || '';
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in env files');
  process.exit(1);
}
console.log('supabase host', new URL(url).host);

const res = await fetch(`${url}/functions/v1/relay`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    apikey: key,
  },
  body: JSON.stringify({ action: 'state', client_key: 'smoke_test_relay_key_001' }),
});
const text = await res.text();
console.log('status', res.status);
console.log(text);

// RPC public state
const rpc = await fetch(`${url}/rest/v1/rpc/get_relay_public_state`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    apikey: key,
  },
  body: '{}',
});
console.log('rpc status', rpc.status);
console.log(await rpc.text());
