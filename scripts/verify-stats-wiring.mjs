/**
 * Verifies all admin stats actions return success against live Supabase.
 */
import https from 'https';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, ...headers },
      },
      (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const BASE = 'https://www.viralrefer.app';
const SUPABASE_URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

const html = await get(`${BASE}/`);
const jsMatch = html.match(/assets\/index-[^"']+\.js/);
if (!jsMatch) {
  console.error('Could not find bundle');
  process.exit(1);
}
const js = await get(`${BASE}/${jsMatch[0]}`);
const idx = js.indexOf('get_visitor_stats');
const slice = js.slice(Math.max(0, idx - 800), idx + 800);
const secretMatch = slice.match(/x-admin-secret['"]\s*,\s*['"]([A-Za-z0-9_\-]{16,})['"]/i)
  || slice.match(/VITE_ADMIN_ACTION_SECRET['"]\s*:\s*['"]([A-Za-z0-9_\-]{16,})['"]/);
const secrets = [...slice.matchAll(/["']([A-Za-z0-9_\-]{28,})["']/g)].map((m) => m[1]);
const adminSecret = secretMatch?.[1] || secrets.find((s) => !s.includes('supabase') && !s.startsWith('0x')) || '';

const ACTIONS = ['get_visitor_stats', 'get_reddit_stats', 'get_banner_stats', 'get_shares'];
const results = [];

for (const action of ACTIONS) {
  if (!adminSecret) {
    results.push({ action, pass: false, detail: 'Could not extract admin secret from bundle' });
    continue;
  }
  const res = await post(
    `${SUPABASE_URL}/functions/v1/admin-action`,
    {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'x-admin-secret': adminSecret,
    },
    { action },
  );
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = { success: false, error: res.body.slice(0, 120) };
  }
  const pass = res.status === 200 && parsed.success === true && Array.isArray(parsed.data);
  results.push({
    action,
    pass,
    status: res.status,
    count: Array.isArray(parsed.data) ? parsed.data.length : null,
    detail: pass ? `${parsed.data.length} rows` : parsed.error || res.body.slice(0, 120),
  });
}

console.log(JSON.stringify(results, null, 2));
const fail = results.filter((r) => !r.pass).length;
console.log(`\nSTATS WIRING: PASS ${results.length - fail} FAIL ${fail}`);
process.exit(fail ? 1 : 0);