/**
 * Set ADMIN_TEST_PASSWORD GitHub Actions secret (CI-only).
 * Does NOT modify Supabase ADMIN_OWNER_PASSWORD (production owner password).
 */
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';

const REPO = 'oliversenterprises-viral/viral-visitor-vl';

function gitCredentialToken() {
  const r = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    shell: true,
  });
  const m = (r.stdout || '').match(/^password=(.+)$/m);
  return m?.[1]?.trim() || '';
}

function ghEnv(token) {
  return { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token };
}

// Read password from audit script (same value already used for live admin-flow verification)
const audit = readFileSync('scripts/audit-admin-flow.mjs', 'utf8');
const pwMatch = audit.match(/fill\('#admin-password-input',\s*'([^']+)'\)/);
const adminPassword = pwMatch?.[1] || process.env.ADMIN_TEST_PASSWORD || '';
if (!adminPassword) {
  console.error('Could not resolve admin test password source');
  process.exit(1);
}

const token = gitCredentialToken();
if (!token) {
  console.error('No GitHub token from git credential — run: gh auth login');
  process.exit(1);
}

const env = ghEnv(token);
const status = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: true, env });
if (status.status !== 0) {
  console.error('GitHub CLI auth failed');
  process.exit(1);
}

const set = spawnSync('gh', ['secret', 'set', 'ADMIN_TEST_PASSWORD', '--repo', REPO], {
  input: adminPassword + '\n',
  encoding: 'utf8',
  shell: true,
  env,
});

if (set.status !== 0) {
  console.error('gh secret set failed:', (set.stderr || set.stdout || '').trim());
  process.exit(1);
}

console.log('OK: ADMIN_TEST_PASSWORD GitHub secret set (CI-only; production password unchanged)');