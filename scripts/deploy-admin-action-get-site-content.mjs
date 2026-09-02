#!/usr/bin/env node
/**
 * Deploy ONLY the `admin-action` Edge Function (registers `get_site_content`)
 * to Supabase project wqbefjzpgsezzwdrvvua.
 *
 * Does NOT:
 *   - deploy the public homepage / Vercel / aliases
 *   - deploy every Edge Function at once
 *   - run the production homepage deploy script
 *   - deploy any other Edge Function
 *
 * Fail-closed: missing SUPABASE_ACCESS_TOKEN exits 1 with a clear error.
 * Do not ask the owner for a token. Do not run this from the draft PR.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/deploy-admin-action-get-site-content.mjs --execute
 *
 * Without --execute the script still requires the token, prints the command, and does not deploy.
 */

import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');

/** Live ViralRefer Supabase project. Do not retarget. */
export const LIVE_SUPABASE_PROJECT_REF = 'wqbefjzpgsezzwdrvvua';
export const ADMIN_ACTION_FUNCTION = 'admin-action';

export const MISSING_TOKEN_ERROR =
  'SUPABASE_ACCESS_TOKEN is missing. Refusing to deploy admin-action. Set a personal access token locally; do not ask the owner for one in chat.';

export function requireSupabaseAccessToken(env = process.env) {
  const token = String(env.SUPABASE_ACCESS_TOKEN || '').trim();
  if (!token) {
    throw new Error(MISSING_TOKEN_ERROR);
  }
  return token;
}

export function assertAdminActionOnlyDeployArgs(argv = process.argv) {
  const args = argv.slice(2);
  for (const flag of args) {
    if (
      flag === '--all' ||
      flag === '--prod' ||
      flag === '--project-ref' ||
      /vercel/i.test(flag) ||
      /deploy-prod/i.test(flag) ||
      /homepage/i.test(flag)
    ) {
      throw new Error(
        'Refusing: this script deploys only admin-action to wqbefjzpgsezzwdrvvua. It must not touch Vercel, the public homepage, --all, or another project-ref.',
      );
    }
    if (flag.startsWith('-') && flag !== '--execute' && flag !== '--print-command') {
      throw new Error(`Refusing unknown flag ${flag}. Allowed: --execute, --print-command.`);
    }
  }
}

export function buildAdminActionOnlyDeployCommand(
  projectRef = LIVE_SUPABASE_PROJECT_REF,
) {
  if (projectRef !== LIVE_SUPABASE_PROJECT_REF) {
    throw new Error(
      `Refusing deploy: project-ref must be ${LIVE_SUPABASE_PROJECT_REF} (got ${projectRef})`,
    );
  }
  return [
    'npx',
    'supabase',
    'functions',
    'deploy',
    ADMIN_ACTION_FUNCTION,
    '--project-ref',
    LIVE_SUPABASE_PROJECT_REF,
    '--yes',
  ];
}

export function formatDeployCommand(argv = buildAdminActionOnlyDeployCommand()) {
  return argv.join(' ');
}

function main(argv = process.argv, env = process.env) {
  assertAdminActionOnlyDeployArgs(argv);
  requireSupabaseAccessToken(env);
  const cmd = buildAdminActionOnlyDeployCommand();
  const printed = formatDeployCommand(cmd);
  const execute = argv.includes('--execute');

  if (!execute) {
    console.log('Would deploy ONLY admin-action (get_site_content) — homepage untouched:');
    console.log(`  ${printed}`);
    console.log('Not deployed. Pass --execute to run that command.');
    return 0;
  }

  console.log(`Deploying ONLY ${ADMIN_ACTION_FUNCTION} → ${LIVE_SUPABASE_PROJECT_REF}`);
  console.log(`$ ${printed}`);
  execFileSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...env, SUPABASE_ACCESS_TOKEN: requireSupabaseAccessToken(env) },
  });
  return 0;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    process.exit(main());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
}

export { main };
