#!/usr/bin/env node
/** Verify Turnstile sitekey + Supabase secret produce valid siteverify (needs real token). */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readSecret() {
  for (const f of ['.env.local', '.env.production.local']) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/TURNSTILE_SECRET_KEY=["']?([^"'\n]+)/);
    if (m) return m[1].trim();
  }
  const out = execSync('npx supabase secrets list --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (!/TURNSTILE_SECRET_KEY/.test(out)) throw new Error('TURNSTILE_SECRET_KEY not in supabase secrets');
  return null; // digest only — cannot verify pair without plaintext secret
}

const html = await fetch('https://www.viralrefer.app/').then((r) => r.text());
const jsPath = html.match(/assets\/index-[^"']+\.js/)?.[0];
const js = jsPath ? await fetch(`https://www.viralrefer.app/${jsPath}`).then((r) => r.text()) : '';
const sitekey = js.match(/0x4[A-Za-z0-9_-]{15,}/)?.[0] ?? null;

const localSecret = readSecret();
console.log(JSON.stringify({
  liveSitekey: sitekey,
  localTurnstileSecretConfigured: Boolean(localSecret),
  note: localSecret
    ? 'Can test siteverify if given a real token'
    : 'Secret only on Supabase (digest) — pair must match sitekey in Cloudflare dashboard',
}, null, 2));