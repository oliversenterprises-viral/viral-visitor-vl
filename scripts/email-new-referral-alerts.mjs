#!/usr/bin/env node
/**
 * READ-ONLY: detect NEW ViralRefer referral actions (excluding owner),
 * email oliversenterprises@gmail.com only when something new appears.
 *
 * Does NOT write to production DB / deploy.
 * Local state only: scripts/.email-referral-alert-state.json
 *
 * Usage:
 *   node scripts/email-new-referral-alerts.mjs
 *   node scripts/email-new-referral-alerts.mjs --dry-run
 *
 * Secrets file:
 *   C:\Users\olive\.grok\secrets\viralrefer-gmail.env
 *
 * Preferred (works when Gmail App Passwords unavailable):
 *   RESEND_API_KEY=re_...
 *   ALERT_TO=oliversenterprises@gmail.com
 *   ALERT_FROM=ViralRefer Alerts <onboarding@resend.dev>   # or your verified domain
 *
 * Optional legacy Gmail SMTP (needs App Password — many accounts block this):
 *   GMAIL_USER=...  GMAIL_APP_PASSWORD=...
 */
import { createClient } from '@supabase/supabase-js';
import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Project root: prefer env, else parent of scripts/ when running from repo, else fixed path. */
const ROOT = process.env.VIRALREFER_ROOT
  ? resolve(process.env.VIRALREFER_ROOT)
  : existsSync(resolve(SCRIPT_DIR, '..', 'package.json'))
    ? resolve(SCRIPT_DIR, '..')
    : resolve(process.env.USERPROFILE || '', 'Projects', 'viral-visitor-vl');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const OWNER_CODE = (process.env.OWNER_CODE || 'VIRAL-97UWEGZ').toUpperCase();
const DRY = process.argv.includes('--dry-run');
const FORCE_TEST = process.argv.includes('--test-email');
// Always prefer durable state under ~/.grok so project cleanup / dual runners share one cursor
const STATE_PATH =
  process.env.ALERT_STATE_PATH ||
  resolve(
    process.env.USERPROFILE || '',
    '.grok',
    'scripts',
    'viralrefer-email-sound',
    '.email-referral-alert-state.json',
  );
const SECRETS_PATH =
  process.env.GMAIL_SECRETS_PATH ||
  resolve(process.env.USERPROFILE || '', '.grok', 'secrets', 'viralrefer-gmail.env');
const LOOKBACK_HOURS = Number(process.env.ALERT_LOOKBACK_HOURS || 48);

const IGNORE_REF_CODES = new Set(
  [OWNER_CODE, 'VIRAL-SMOKETEST', 'VIRAL-AUDITPROBE', 'DEMO1234', 'VIRAL-DEMOCODE'].map((c) =>
    c.toUpperCase(),
  ),
);

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/**
 * Resolve service_role without depending on broken `npx supabase` (SchemaError on inserted_at).
 * Order: env → secrets file → durable CLI binary → npx fallback.
 */
function serviceKey() {
  const fileEnv = loadEnvFile(SECRETS_PATH);
  const fromEnv =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SERVICE_ROLE_KEY ||
    '';
  if (fromEnv && fromEnv.startsWith('eyJ') && fromEnv.length > 40) {
    return fromEnv.trim();
  }

  const userProfile = process.env.USERPROFILE || '';
  const candidates = [
    resolve(userProfile, '.grok', 'bin', 'supabase.exe'),
    resolve(userProfile, '.grok', 'bin', 'supabase-go.exe'),
    'supabase',
    'npx',
  ];

  const runCli = (bin) => {
    if (bin === 'npx') {
      return execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
        encoding: 'utf8',
        cwd: ROOT,
        windowsHide: true,
      });
    }
    if (bin.includes('\\') || bin.includes('/')) {
      if (!existsSync(bin)) return null;
      return execSync(`"${bin}" projects api-keys --project-ref wqbefjzpgsezzwdrvvua`, {
        encoding: 'utf8',
        cwd: ROOT,
        windowsHide: true,
        shell: true,
      });
    }
    return execSync(`${bin} projects api-keys --project-ref wqbefjzpgsezzwdrvvua`, {
      encoding: 'utf8',
      cwd: ROOT,
      windowsHide: true,
      shell: true,
    });
  };

  let lastErr = null;
  for (const bin of candidates) {
    try {
      const out = runCli(bin);
      if (!out) continue;
      // Keys may wrap across lines in table output
      const joined = String(out).replace(/\s+/g, ' ');
      const m = joined.match(/service_role\s*\|\s*(eyJ[A-Za-z0-9._\-]+)/);
      if (m) return m[1];
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Could not resolve SUPABASE_SERVICE_ROLE_KEY (set it in ${SECRETS_PATH}). Last CLI error: ${String(lastErr?.message || lastErr || 'none').slice(0, 300)}`,
  );
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return { referralIds: [], shareIds: [], eventKeys: [], seeded: false };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { referralIds: [], shareIds: [], eventKeys: [], seeded: false };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  state.referralIds = (state.referralIds || []).slice(-800);
  state.shareIds = (state.shareIds || []).slice(-800);
  state.eventKeys = (state.eventKeys || []).slice(-3000);
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function isOwnerRelated(code) {
  if (!code) return false;
  return IGNORE_REF_CODES.has(String(code).toUpperCase());
}

function redactIp(ip) {
  if (!ip) return '';
  return String(ip).replace(/\.\d+$/, '.*');
}

function sendEmailViaPowerShell({ user, pass, to, subject, body }) {
  const ps1 = resolve(ROOT, 'scripts', 'send-gmail-alert.ps1');
  const bodyFile = join(tmpdir(), `vr-alert-body-${Date.now()}.txt`);
  writeFileSync(bodyFile, body, 'utf8');
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      ps1,
      '-From',
      user,
      '-To',
      to,
      '-Subject',
      subject,
      '-BodyFile',
      bodyFile,
      '-AppPassword',
      pass,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  try {
    if (existsSync(bodyFile)) writeFileSync(bodyFile, '');
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    throw new Error(
      `send-gmail-alert.ps1 failed (code ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 500)}`,
    );
  }
  return (r.stdout || '').trim();
}

/** Resend HTTP API — no Gmail App Password required; inbox is still Gmail. */
async function sendEmailViaResend({ apiKey, from, to, subject, body }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${text.slice(0, 400)}`);
  }
  return `SENT via Resend id=${json?.id || 'ok'} to=${to}`;
}

const fileEnv = loadEnvFile(SECRETS_PATH);
const GMAIL_USER = process.env.GMAIL_USER || fileEnv.GMAIL_USER || 'oliversenterprises@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || fileEnv.GMAIL_APP_PASSWORD || '';
const ALERT_TO = process.env.ALERT_TO || fileEnv.ALERT_TO || 'oliversenterprises@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || fileEnv.RESEND_API_KEY || '';
const ALERT_FROM =
  process.env.ALERT_FROM ||
  fileEnv.ALERT_FROM ||
  'ViralRefer Alerts <onboarding@resend.dev>';

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
const state = loadState();
const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

const [refs, shares, events, totalRpc] = await Promise.all([
  admin
    .from('referrals')
    .select('id, referrer_code, referred_ip, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(150),
  admin
    .from('shares')
    .select('id, platform, referrer_code, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(150),
  admin
    .from('visitor_events')
    .select('id, event_name, country_code, ref_code, created_at')
    .gte('created_at', sinceIso)
    .in('event_name', [
      'GetReferralLink',
      'CopyReferralLink',
      'ShareReferral',
      'ReceiptGenerated',
      'ChallengeLanding',
      'ChallengeLinkReady',
    ])
    .order('created_at', { ascending: false })
    .limit(400),
  admin.rpc('get_total_referral_count'),
]);

if (refs.error) throw new Error(refs.error.message);
if (shares.error) throw new Error(shares.error.message);
if (events.error) throw new Error(events.error.message);

const knownRefs = new Set(state.referralIds || []);
const knownShares = new Set(state.shareIds || []);
const knownEvents = new Set(state.eventKeys || []);
const isSeed = !state.seeded;

const alerts = [];

for (const row of [...(refs.data || [])].reverse()) {
  if (knownRefs.has(row.id)) continue;
  knownRefs.add(row.id);
  if (isOwnerRelated(row.referrer_code)) continue;
  if (isSeed) continue; // seed without email flood
  alerts.push({
    kind: 'VERIFIED_REFERRAL',
    referrer_code: row.referrer_code,
    created_at: row.created_at,
    detail: `ip=${redactIp(row.referred_ip)}`,
  });
}

for (const row of [...(shares.data || [])].reverse()) {
  if (knownShares.has(row.id)) continue;
  knownShares.add(row.id);
  if (isOwnerRelated(row.referrer_code)) continue;
  if (isSeed) continue;
  alerts.push({
    kind: 'SHARE',
    referrer_code: row.referrer_code,
    created_at: row.created_at,
    detail: `platform=${row.platform}`,
  });
}

for (const row of [...(events.data || [])].reverse()) {
  const key = row.id || `${row.event_name}:${row.created_at}:${row.ref_code}`;
  if (knownEvents.has(key)) continue;
  knownEvents.add(key);
  if (isOwnerRelated(row.ref_code)) continue;
  if (isSeed) continue;
  alerts.push({
    kind: row.event_name,
    referrer_code: row.ref_code || '(none)',
    created_at: row.created_at,
    detail: `country=${row.country_code || '?'}`,
  });
}

state.referralIds = [...knownRefs];
state.shareIds = [...knownShares];
state.eventKeys = [...knownEvents];
state.seeded = true;
state.lastRunAt = new Date().toISOString();
saveState(state);

if (isSeed && !FORCE_TEST) {
  console.log(
    JSON.stringify({
      ok: true,
      seeded: true,
      message: 'Cursor seeded. No email sent. Future NEW non-owner actions will email.',
      owner_excluded: OWNER_CODE,
      board_total: totalRpc.data ?? null,
      to: ALERT_TO,
    }),
  );
  process.exit(0);
}

if (alerts.length === 0 && !FORCE_TEST) {
  console.log(
    JSON.stringify({
      ok: true,
      emailed: false,
      message: 'No new non-owner referral actions',
      board_total: totalRpc.data ?? null,
    }),
  );
  process.exit(0);
}

if (FORCE_TEST && alerts.length === 0) {
  alerts.push({
    kind: 'TEST_ALERT',
    referrer_code: 'SYSTEM-TEST',
    created_at: new Date().toISOString(),
    detail: 'manual --test-email from Nova (pipeline check)',
  });
}

const lines = [
  'ViralRefer — new referral activity (excluding your owner code)',
  '',
  `Site: https://www.viralrefer.app`,
  `Owner excluded: ${OWNER_CODE}`,
  `Board total referrals: ${totalRpc.data ?? 'n/a'}`,
  `New events: ${alerts.length}`,
  `Detected at: ${new Date().toISOString()}`,
  '',
  '---',
];
for (const a of alerts) {
  lines.push(
    `• [${a.kind}] code=${a.referrer_code} @ ${a.created_at}${a.detail ? ` · ${a.detail}` : ''}`,
  );
}
lines.push('', '— Nova Superpower (read-only alert) · no prod changes');
const body = lines.join('\n');
const subject = `ViralRefer: ${alerts.length} new action(s) (not yours)`;

if (DRY) {
  console.log(JSON.stringify({ ok: true, dry_run: true, would_email: ALERT_TO, subject, alerts }, null, 2));
  process.exit(0);
}

let sendResult;
if (RESEND_API_KEY && RESEND_API_KEY !== 'PASTE_RESEND_API_KEY_HERE') {
  sendResult = await sendEmailViaResend({
    apiKey: RESEND_API_KEY,
    from: ALERT_FROM,
    to: ALERT_TO,
    subject,
    body,
  });
} else if (GMAIL_APP_PASSWORD && GMAIL_APP_PASSWORD !== 'PASTE_APP_PASSWORD_HERE') {
  sendResult = sendEmailViaPowerShell({
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
    to: ALERT_TO,
    subject,
    body,
  });
} else {
  console.error(
    JSON.stringify({
      ok: false,
      error: 'No email provider configured',
      why_gmail_app_password_fails:
        'Google shows "setting not available" when App Passwords are blocked (no 2SV, Workspace policy, or account type).',
      recommended: 'Use free Resend API — emails still arrive in Gmail inbox',
      steps: [
        '1. Sign up https://resend.com (free)',
        '2. API Keys → Create → copy re_... key',
        `3. Put RESEND_API_KEY=re_... in ${SECRETS_PATH}`,
        '4. Keep ALERT_TO=oliversenterprises@gmail.com',
        '5. Reply "resend key set" for a test email',
      ],
      secrets_file: SECRETS_PATH,
      alerts_pending: alerts.length,
      subject,
    }),
  );
  process.exit(2);
}

// Local-only: Windows toast "New Referral Activity" + designated sound.
// Does not deploy or change production; failures must never block the email path.
function notifyNewReferralActivity(opts) {
  try {
    const notifyPs = resolve(
      process.env.USERPROFILE || '',
      '.grok',
      'scripts',
      'Show-ViralReferNotification.ps1',
    );
    if (!existsSync(notifyPs)) return { ok: false, reason: 'notify script missing' };
    const title = 'New Referral Activity';
    const count = Number(opts.count) || 0;
    const kinds = Array.isArray(opts.kinds) ? opts.kinds.slice(0, 4).join(', ') : '';
    let message = count === 1
      ? '1 new referral action — check your Gmail.'
      : `${count} new referral actions — check your Gmail.`;
    if (kinds) message += ` (${kinds})`;
    const r = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        notifyPs,
        '-Title',
        title,
        '-Message',
        String(message).slice(0, 200),
      ],
      { encoding: 'utf8', timeout: 20000, windowsHide: true },
    );
    return {
      ok: r.status === 0,
      status: r.status,
      out: (r.stdout || '').trim().slice(0, 300),
    };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 200) };
  }
}

const kinds = [...new Set(alerts.map((a) => a.kind))];
const notify = notifyNewReferralActivity({ count: alerts.length, kinds });

console.log(
  JSON.stringify({
    ok: true,
    emailed: true,
    to: ALERT_TO,
    subject,
    count: alerts.length,
    send: sendResult,
    notify,
  }),
);
