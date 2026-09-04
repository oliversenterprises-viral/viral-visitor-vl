#!/usr/bin/env node
/**
 * Build locally and Direct-Upload to Cloudflare Workers (www + workers.dev).
 *
 *   npm run deploy:cloudflare
 *
 * Vite only bakes VITE_* into the client. This script loads the public
 * client keys before `vite build` so Desk / leaderboard / Turnstile work.
 * It never writes secrets into wrangler.toml or git.
 *
 * Auth: CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID), or prior `npx wrangler login`.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

/** Public client keys only. Never load owner passwords or action secrets. */
const CLIENT_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_TURNSTILE_SITEKEY',
  'VITE_REDDIT_PIXEL_ID',
  'VITE_GOOGLE_SITE_VERIFICATION',
];

const REQUIRED_CLIENT_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_TURNSTILE_SITEKEY',
];

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!CLIENT_ENV_KEYS.includes(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function envFileCandidates() {
  const sibling = resolve(ROOT, '..', 'viral-visitor-vl');
  return [
    resolve(ROOT, '.env.production.local'),
    resolve(ROOT, '.env.local'),
    resolve(ROOT, '.env'),
    resolve(sibling, '.env.production.local'),
    resolve(sibling, '.env.local'),
    resolve(sibling, '.env.vercel.prod'),
  ];
}

function loadClientEnv() {
  const loadedFrom = [];
  for (const file of envFileCandidates()) {
    const parsed = parseEnvFile(file);
    const keys = Object.keys(parsed);
    if (!keys.length) continue;
    loadedFrom.push(file);
    for (const key of keys) {
      if (!String(process.env[key] || '').trim()) process.env[key] = parsed[key];
    }
  }
  const missing = REQUIRED_CLIENT_ENV.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(
      `[deploy:cloudflare] Missing ${missing.join(', ')}. Put them in .env.production.local (gitignored) and rebuild.`,
    );
  }
  const cache = resolve(ROOT, '.env.production.local');
  const lines = CLIENT_ENV_KEYS.filter((key) => String(process.env[key] || '').trim()).map(
    (key) => `${key}=${process.env[key]}`,
  );
  writeFileSync(cache, `${lines.join('\n')}\n`, 'utf8');
  console.log(
    `[deploy:cloudflare] Client env ready (${REQUIRED_CLIENT_ENV.join(', ')}). Files: ${loadedFrom.length ? loadedFrom.join(' | ') : 'process.env'}`,
  );
}

function run(cmd, args) {
  const line = [cmd, ...args].join(' ');
  execSync(line, { cwd: ROOT, stdio: 'inherit', env: process.env, shell: true });
}

loadClientEnv();

const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!token) {
  console.warn(
    '[deploy:cloudflare] CLOUDFLARE_API_TOKEN unset. Wrangler will use an existing login if present.',
  );
}

run('npx', ['tsc']);
run('npx', ['vite', 'build']);

if (!existsSync(DIST)) {
  throw new Error('dist/ missing after vite build');
}

run('npx', ['wrangler', 'deploy', '--config', 'wrangler.toml']);

console.log('[deploy:cloudflare] Uploaded. www.viralrefer.app serves this Worker after DNS is on Cloudflare.');
