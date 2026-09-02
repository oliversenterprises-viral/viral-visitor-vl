#!/usr/bin/env node
/**
 * One-command production deploy for Vercel project viralrefer-premium.
 * Live is only https://www.viralrefer.app. Preview is not live.
 *
 *   npm run deploy:viralrefer-premium
 *
 * Fails closed if VERCEL_TOKEN is missing. Does not prompt. Does not vercel login.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIVE_ORIGIN = 'https://www.viralrefer.app';
export const VERCEL_PROJECT_NAME = 'viralrefer-premium';
export const VERCEL_PROJECT_ID = 'prj_lEguzmle2JOlyRyzO0zHjG2HtpNv';
export const VERCEL_ORG_ID = 'team_hnd0XbdMIawij8c5v92NkJiQ';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function requireVercelProdToken(env = process.env) {
  const token = String(env.VERCEL_TOKEN || '').trim();
  if (!token) {
    throw new Error(
      'VERCEL_TOKEN is missing. Refusing production deploy of viralrefer-premium. Preview is not live.',
    );
  }
  return token;
}

export function isLiveOrigin(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.origin === LIVE_ORIGIN;
  } catch {
    return false;
  }
}

export function writeVercelProjectLink(root = ROOT) {
  const dir = resolve(root, '.vercel');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, 'project.json'),
    `${JSON.stringify(
      {
        orgId: process.env.VERCEL_ORG_ID || VERCEL_ORG_ID,
        projectId: process.env.VERCEL_PROJECT_ID || VERCEL_PROJECT_ID,
        projectName: VERCEL_PROJECT_NAME,
      },
      null,
      2,
    )}\n`,
  );
}

export async function readLiveVersionJson(fetchImpl = fetch) {
  const res = await fetchImpl(`${LIVE_ORIGIN}/version.json`, {
    headers: { 'cache-control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`Live version.json HTTP ${res.status}`);
  }
  return res.json();
}

function runProdDeploy(token) {
  writeVercelProjectLink();
  execFileSync('npx', ['vercel', 'deploy', '--prod', '--yes', `--token=${token}`], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      VERCEL_TOKEN: token,
      VERCEL_ORG_ID: process.env.VERCEL_ORG_ID || VERCEL_ORG_ID,
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || VERCEL_PROJECT_ID,
    },
  });
}

async function main() {
  const token = requireVercelProdToken();
  console.log(`Deploying this checkout to ${VERCEL_PROJECT_NAME} → ${LIVE_ORIGIN}`);
  console.log('Preview is not live.');
  runProdDeploy(token);
  const version = await readLiveVersionJson();
  console.log(`Live version.json: ${JSON.stringify(version)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
