#!/usr/bin/env node
/**
 * Poll live version.json until it matches this git SHA.
 * Used by CI live-audit so smoke does not race the Vercel Git deploy.
 */
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const LIVE_VERSION_URL =
  process.env.SMOKE_LIVE_URL
    ? `${String(process.env.SMOKE_LIVE_URL).replace(/\/$/, '')}/version.json`
    : 'https://www.viralrefer.app/version.json';

export function liveVersionMatches(expectedSha, payload) {
  const want = String(expectedSha || '').trim().toLowerCase();
  if (!want || !payload || typeof payload !== 'object') return false;
  const short = want.slice(0, 7);
  const version = String(payload.version || '').toLowerCase();
  const commit = String(payload.commit || '').toLowerCase();
  return version === short || version === want || commit === want || (commit && commit.startsWith(short));
}

function expectedSha() {
  return String(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
}

async function fetchVersion() {
  const res = await fetch(LIVE_VERSION_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function waitForLiveVersion(opts = {}) {
  const sha = opts.sha || expectedSha();
  const timeoutMs = Number(opts.timeoutMs ?? process.env.LIVE_VERSION_WAIT_MS ?? 180000);
  const intervalMs = Number(opts.intervalMs ?? 8000);
  if (!sha) {
    throw new Error('Set GITHUB_SHA (or pass sha) — nothing to match against version.json');
  }

  const started = Date.now();
  let last = null;
  while (Date.now() - started <= timeoutMs) {
    try {
      last = await fetchVersion();
      if (liveVersionMatches(sha, last)) {
        return last;
      }
    } catch (err) {
      last = { error: err instanceof Error ? err.message : String(err) };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const seen = last ? JSON.stringify(last) : 'no response';
  throw new Error(`Live version.json did not match ${sha.slice(0, 7)} within ${timeoutMs}ms. Last: ${seen}`);
}

function isDirectRun() {
  try {
    return fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase();
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  waitForLiveVersion()
    .then((payload) => {
      console.log(
        `[wait-for-live-version] matched ${String(payload.commit || payload.version)}`,
      );
    })
    .catch((err) => {
      console.error(`[wait-for-live-version] ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
}
