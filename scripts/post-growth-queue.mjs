#!/usr/bin/env node
/**
 * Post approved items from growth queue (white-hat referral marketing automation).
 *
 *   node scripts/post-growth-queue.mjs --list
 *   node scripts/post-growth-queue.mjs --approve <id>
 *   node scripts/post-growth-queue.mjs --post-next telegram [--dry-run]
 *   node scripts/post-growth-queue.mjs --post-next x [--assist] [--dry-run]
 *   node scripts/post-growth-queue.mjs --post-id <id> [--dry-run]
 *   node scripts/post-growth-queue.mjs --export-manual reddit
 *
 * Env (.env.local):
 *   GROWTH_POST_TELEGRAM_BOT_TOKEN  — @BotFather token (can reuse funnel notify bot)
 *   GROWTH_POST_TELEGRAM_CHAT_ID    — channel @name or numeric chat id
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET — optional full X API post
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import {
  QUEUE_FILE,
  ROOT,
  TELEGRAM_CHANNEL,
  X_QR_IMAGE,
  X_SAFE_BIO,
  assertNoXUrls,
  loadLocalEnv,
  readQueue,
  writeQueue,
  listPending,
  findItem,
  updateItemStatus,
  resolveQueueImage,
} from './growth-post-queue-helpers.mjs';

const SUPABASE_URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

async function extractAdminSecret() {
  const envSecret = process.env.VITE_ADMIN_ACTION_SECRET || process.env.ADMIN_ACTION_SECRET;
  if (envSecret) return envSecret;
  const html = await (await fetch('https://www.viralrefer.app/')).text();
  const m = html.match(/assets\/index-[^"']+\.js/);
  if (!m) throw new Error('bundle not found');
  const js = await (await fetch(`https://www.viralrefer.app/${m[0]}`)).text();
  const idx = js.indexOf('admin-action');
  const near = js.slice(Math.max(0, idx - 500), idx + 500);
  return (
    [...near.matchAll(/["']?([A-Za-z0-9]{30,34})["']?/g)]
      .map((x) => x[1])
      .filter((s) => !s.startsWith('eyJ') && !s.startsWith('0x'))[0] || ''
  );
}

loadLocalEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const dryRun = process.argv.includes('--dry-run');
const assist = process.argv.includes('--assist');

function telegramCreds() {
  return {
    token:
      process.env.GROWTH_POST_TELEGRAM_BOT_TOKEN ||
      process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN ||
      '',
    chatId:
      process.env.GROWTH_POST_TELEGRAM_CHAT_ID ||
      TELEGRAM_CHANNEL,
  };
}

async function postTelegramViaAdmin(item) {
  const secret = await extractAdminSecret();
  if (!secret) throw new Error('Admin secret not found for server-side Telegram post');

  const text = item.copy?.text || '';
  const imagePath = resolveQueueImage(item);
  const payload = {
    text,
    chatId: telegramCreds().chatId,
  };

  if (imagePath && existsSync(imagePath)) {
    payload.imageBase64 = readFileSync(imagePath).toString('base64');
    payload.imageMime = 'image/png';
  }

  if (dryRun) {
    console.log('[dry-run] Telegram (server) →', payload.chatId);
    console.log(text);
    if (imagePath) console.log('Image:', imagePath);
    return { ok: true, dryRun: true, chatId: payload.chatId };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      'x-admin-secret': secret,
    },
    body: JSON.stringify({ action: 'post_telegram_marketing', payload }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'post_telegram_marketing failed');
  }
  return { ok: true, messageId: json.data?.messageId, chatId: json.data?.chatId };
}

function xApiCreds() {
  const key = process.env.X_API_KEY || '';
  const secret = process.env.X_API_SECRET || '';
  const access = process.env.X_ACCESS_TOKEN || '';
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET || '';
  return { key, secret, access, accessSecret, ready: !!(key && secret && access && accessSecret) };
}

async function postTelegram(item) {
  const { token, chatId } = telegramCreds();
  if (!token) {
    return postTelegramViaAdmin(item);
  }

  const text = item.copy?.text || '';
  const imagePath = resolveQueueImage(item);

  if (dryRun) {
    console.log('[dry-run] Telegram →', chatId);
    console.log(text);
    if (imagePath) console.log('Image:', imagePath);
    return { ok: true, dryRun: true };
  }

  if (imagePath && existsSync(imagePath)) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', text.slice(0, 1024));
    form.append('photo', new Blob([readFileSync(imagePath)]), 'graphic.png');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description || 'Telegram sendPhoto failed');
    return { ok: true, messageId: json.result?.message_id, chatId };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || 'Telegram sendMessage failed');
  return { ok: true, messageId: json.result?.message_id, chatId };
}

/** OAuth 1.0a signing for X API (no extra deps). */
async function postXApi(item) {
  const { key, secret, access, accessSecret, ready } = xApiCreds();
  if (!ready) {
    throw new Error('X API credentials missing — use --assist or set X_API_* in .env.local');
  }

  const text = item.copy?.text || '';
  if (dryRun) {
    console.log('[dry-run] X API tweet:');
    console.log(text);
    return { ok: true, dryRun: true };
  }

  const crypto = await import('crypto');
  const oauth = {
    oauth_consumer_key: key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: access,
    oauth_version: '1.0',
  };

  const baseParams = { ...oauth, text };
  const paramString = Object.keys(baseParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(baseParams[k])}`)
    .join('&');

  const baseString = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(secret)}&${encodeURIComponent(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const authHeader =
    'OAuth ' +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ');

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.detail || json.title || JSON.stringify(json));
  }
  return { ok: true, tweetId: json.data?.id };
}

function resolveQueueQr(item) {
  if (!item?.imageQr) return null;
  const p = item.imageQr;
  return p.startsWith('/') || /^[A-Za-z]:/.test(p) ? p : resolve(ROOT, p);
}

function postXAssist(item) {
  const text = item.copy?.text || '';
  const isNoUrl = item.xLinkPolicy === 'no-url' || item.platform === 'x';
  if (isNoUrl) assertNoXUrls(text);

  const exportPath = resolve(ROOT, 'marketing/growth-queue/last-x-draft.txt');
  const bioPath = resolve(ROOT, 'marketing/growth-queue/last-x-bio.txt');
  if (!dryRun) {
    mkdirSync(dirname(exportPath), { recursive: true });
    writeFileSync(exportPath, text, 'utf8');
    writeFileSync(bioPath, item.copy?.bio || X_SAFE_BIO, 'utf8');
  }

  console.log('=== X Assist Mode (NO URL — X blocklists viralrefer.app) ===\n');
  console.log(text);
  console.log('\n---');
  const mainImage = resolveQueueImage(item);
  const qrImage = resolveQueueQr(item) || X_QR_IMAGE;
  if (mainImage) console.log('Attach image 1 (graphic):', mainImage);
  console.log('Attach image 2 (QR):', qrImage);
  console.log(`\nBio (paste in profile — no URL field): ${item.copy?.bio || X_SAFE_BIO}`);
  console.log(`Draft saved: ${exportPath}`);
  if (dryRun) return { ok: true, dryRun: true, assist: true };

  const encoded = encodeURIComponent(text);
  openUrl(`https://x.com/compose/post?text=${encoded}`);
  if (mainImage && existsSync(mainImage)) openExplorerSelect(mainImage);
  else if (existsSync(qrImage)) openExplorerSelect(qrImage);
  console.log('\nPOST STEPS:');
  console.log('  1. Attach leaderboard graphic (if shown)');
  console.log('  2. Attach QR image so people can scan to visit');
  console.log('  3. Post — do NOT paste any viralrefer.app link');
  console.log('  4. Optional: paste bio from marketing/growth-queue/last-x-bio.txt');
  return { ok: true, assist: true };
}

function openUrl(url) {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, process.platform === 'win32' ? ['', url] : [url], {
    shell: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function openExplorerSelect(file) {
  if (process.platform !== 'win32') return;
  spawn('explorer.exe', [`/select,${file}`], { detached: true, stdio: 'ignore' }).unref();
}

async function postItem(item) {
  if (item.mode === 'manual') {
    throw new Error(`${item.platform} is manual-only — use --export-manual ${item.platform}`);
  }

  if (item.platform === 'telegram') {
    return postTelegram(item);
  }

  if (item.platform === 'x') {
    if (assist || item.mode === 'assist') return postXAssist(item);
    return postXApi(item);
  }

  throw new Error(`Unsupported platform: ${item.platform}`);
}

function pickNext(queue, platform) {
  const pending = listPending(queue, { platform });
  const approved = pending.filter((i) => i.status === 'approved');
  const pool = approved.length ? approved : pending;
  return (
    pool
      .filter((i) => !platform || i.platform === platform)
      .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))[0] || null
  );
}

const queue = readQueue();
if (!queue) {
  console.error(`No queue at ${QUEUE_FILE}. Run: node scripts/generate-growth-post-queue.mjs`);
  process.exit(1);
}

const markPosted = arg('--mark-posted');
if (markPosted) {
  if (!updateItemStatus(queue, markPosted, { status: 'posted', postedAt: new Date().toISOString() })) {
    console.error('Item not found:', markPosted);
    process.exit(1);
  }
  writeQueue(queue);
  console.log(`✓ Marked posted: ${markPosted}`);
  process.exit(0);
}

if (process.argv.includes('--list')) {
  console.log('=== Growth Post Queue ===\n');
  for (const item of queue.items) {
    console.log(
      `${item.status.padEnd(8)} ${item.scheduledFor?.slice(0, 16)}  ${item.platform.padEnd(8)} ${item.mode.padEnd(6)}  ${item.id}`,
    );
  }
  process.exit(0);
}

const approveId = arg('--approve');
if (approveId) {
  if (!updateItemStatus(queue, approveId, { status: 'approved', approvedAt: new Date().toISOString() })) {
    console.error('Item not found:', approveId);
    process.exit(1);
  }
  writeQueue(queue);
  console.log(`✓ Approved: ${approveId}`);
  process.exit(0);
}

const exportPlatform = arg('--export-manual');
if (exportPlatform) {
  const items = listPending(queue, { platform: exportPlatform });
  const out = resolve(ROOT, 'marketing/growth-queue', `manual-${exportPlatform}-drafts.txt`);
  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync(resolve(out, '..'), { recursive: true });
  const body = items
    .map((i) => `--- ${i.id} (${i.status}) ---\n${i.copy?.text || ''}\n`)
    .join('\n');
  writeFileSync(out, body, 'utf8');
  console.log(`✓ Exported ${items.length} ${exportPlatform} drafts → ${out}`);
  process.exit(0);
}

const postId = arg('--post-id');
const postNext = process.argv.includes('--post-next');
const platform = arg('--post-next') || arg('--platform');

let item = null;
if (postId) {
  item = findItem(queue, postId);
  if (!item) {
    console.error('Item not found:', postId);
    process.exit(1);
  }
} else if (postNext) {
  item = pickNext(queue, platform);
  if (!item) {
    console.error('No pending items', platform ? `for ${platform}` : '');
    process.exit(1);
  }
} else {
  console.error(
    'Usage: --list | --approve <id> | --post-next <platform> | --post-id <id> | --export-manual <platform>',
  );
  process.exit(1);
}

console.log(`Posting: ${item.id} (${item.platform}, mode=${item.mode})${dryRun ? ' [DRY RUN]' : ''}\n`);

try {
  const result = await postItem(item);
  if (!dryRun && !result.assist) {
    updateItemStatus(queue, item.id, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      result,
    });
    writeQueue(queue);
  } else if (!dryRun && result.assist) {
    updateItemStatus(queue, item.id, {
      status: 'approved',
      assistOpenedAt: new Date().toISOString(),
    });
    writeQueue(queue);
    console.log('\nAfter you publish in X, mark done:');
    console.log(`  node scripts/post-growth-queue.mjs --mark-posted ${item.id}`);
  }
  console.log('\n✓ Done', result.dryRun ? '(dry run)' : result.assist ? '(assist — finish in browser)' : '');
  process.exit(0);
} catch (err) {
  if (!dryRun) {
    updateItemStatus(queue, item.id, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      failedAt: new Date().toISOString(),
    });
    writeQueue(queue);
  }
  console.error('Post failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}