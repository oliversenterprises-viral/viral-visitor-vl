#!/usr/bin/env node
/**
 * Production deploy + mandatory referral smoke test.
 *   npm run deploy:prod
 *
 * Deploys edge functions + Vercel frontend, then runs test:smoke:prod.
 * Exits non-zero if smoke fails (blocks silent referral regressions).
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'wqbefjzpgsezzwdrvvua';

function run(cmd, label) {
  console.log(`\n>>> ${label}\n$ ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

console.log('=== ViralRefer production deploy (with smoke gate) ===');
console.log('Vercel project: viralrefer-premium → https://www.viralrefer.app\n');

run(
  `npx supabase functions deploy record-referral --project-ref ${PROJECT_REF} --yes`,
  'Deploy record-referral edge function',
);
run(
  `npx supabase functions deploy admin-action --project-ref ${PROJECT_REF} --yes`,
  'Deploy admin-action edge function',
);
run('npx vercel --prod --yes', 'Deploy frontend to Vercel production');
run('npm run test:smoke:prod', 'Run production referral smoke test');

console.log('\n=== Deploy + smoke complete ===');