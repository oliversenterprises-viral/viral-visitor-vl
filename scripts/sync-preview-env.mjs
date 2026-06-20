/**
 * Sync production-only Vercel env vars to Preview via Vercel API.
 * Never prints secret values.
 */
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import https from 'https';

const PROJECT_ID = 'prj_lEguzmle2JOlyRyzO0zHjG2HtpNv';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function loadVercelToken() {
  const candidates = [
    path.join(homedir(), 'AppData', 'Roaming', 'xdg.data', 'com.vercel.cli', 'auth.json'),
    path.join(homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const auth = JSON.parse(readFileSync(p, 'utf8'));
    if (auth.token) return auth.token;
  }
  return process.env.VERCEL_TOKEN || '';
}

async function extractAdminSecret() {
  const html = await get('https://www.viralrefer.app/');
  const m = html.match(/assets\/index-[^"']+\.js/);
  if (!m) return '';
  const js = await get(`https://www.viralrefer.app/${m[0]}`);
  const idx = js.indexOf('admin-action');
  if (idx < 0) return '';
  const near = js.slice(Math.max(0, idx - 500), idx + 500);
  const hits = [...near.matchAll(/["']?([A-Za-z0-9]{30,34})["']?/g)]
    .map((x) => x[1])
    .filter((s) => !s.startsWith('eyJ') && !s.startsWith('0x'));
  return hits[0] || '';
}

async function listProjectEnvs(token) {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list env failed: ${res.status}`);
  const data = await res.json();
  return data.envs || data;
}

async function addPreviewEnv(token, key, value) {
  const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: ['preview'],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }
  return true;
}

const VARS = {
  VITE_ADMIN_ACTION_SECRET: await extractAdminSecret(),
  VITE_REDDIT_PIXEL_ID: 'a2_jr6jdbg2r4',
  VITE_TURNSTILE_SITEKEY: '0x4AAAAAADbxoHgHBgOr7tC9',
};

const token = loadVercelToken();
if (!token) {
  console.error('No Vercel token — run: npx vercel login');
  process.exit(1);
}

const envs = await listProjectEnvs(token);
const hasPreview = (key) =>
  envs.some((e) => e.key === key && (e.target || []).includes('preview'));

let added = 0;
for (const [key, value] of Object.entries(VARS)) {
  if (!value) {
    console.log(`WARN skip ${key} — no value`);
    continue;
  }
  if (hasPreview(key)) {
    console.log(`OK ${key} already on Preview`);
    continue;
  }
  try {
    await addPreviewEnv(token, key, value);
    console.log(`ADD ${key} → Preview`);
    added++;
  } catch (e) {
    console.log(`FAIL ${key}: ${e.message}`);
  }
}

console.log(`Done (${added} added)`);
process.exit(0);