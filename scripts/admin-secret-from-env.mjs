/**
 * Admin Edge secret for local scripts. Never scrape the public JS bundle.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

export function loadLocalEnv() {
  loadEnvFile(resolve(ROOT, '.env.local'));
  loadEnvFile(resolve(ROOT, '.env.production.local'));
}

/** Returns ADMIN_ACTION_SECRET. Throws if missing. Does not print the value. */
export function resolveAdminActionSecret() {
  loadLocalEnv();
  const secret = String(
    process.env.ADMIN_ACTION_SECRET || '',
  ).trim();
  if (!secret) {
    throw new Error('Set ADMIN_ACTION_SECRET in .env.local — do not scrape the public bundle');
  }
  return secret;
}
