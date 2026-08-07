#!/usr/bin/env node
/**
 * Render Facebook/IG growth Reel (9:16, ~20s) from marketing/growth-24h/growth-reel-24h.html
 * Outputs to marketing/growth-24h + Desktop + Downloads. Does not touch production.
 *
 *   node scripts/render-growth-reel.mjs
 *   node scripts/render-growth-reel.mjs --fps 12
 */
import { chromium } from 'playwright';
import { spawnSync, execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  writeFileSync,
  copyFileSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIR = resolve(ROOT, 'marketing/growth-24h');
const HTML = resolve(DIR, 'growth-reel-24h.html');
const MUSIC = resolve(ROOT, 'marketing/video-promo/promo-music.mp3');
const FRAMES = resolve(DIR, '.reel-tmp/frames');
const DURATION_SEC = 20;
const W = 1080;
const H = 1920;

const args = process.argv.slice(2);
const fps = Number(args.find((a, i) => args[i - 1] === '--fps') || 12);

function findFfmpeg() {
  try {
    const which = execSync('where.exe ffmpeg', { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (which && existsSync(which)) return which;
  } catch {
    /* continue */
  }
  const wingetRoot = join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (existsSync(wingetRoot)) {
    const stack = [wingetRoot];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe') return p;
        if (e.isDirectory() && !e.name.startsWith('.')) stack.push(p);
      }
    }
  }
  return null;
}

function run(cmd, cmdArgs, label) {
  console.log(`\n>>> ${label}\n$ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

async function captureFrames() {
  if (!existsSync(HTML)) throw new Error(`Missing ${HTML}`);
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  console.log(`Capturing ${DURATION_SEC}s @ ${fps} fps (${DURATION_SEC * fps} frames)…`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });

  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  await page.evaluate(() => {
    document.getAnimations({ subtree: true }).forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
  });

  const total = DURATION_SEC * fps;
  for (let i = 0; i < total; i++) {
    const tMs = (i / fps) * 1000;
    await page.evaluate((ms) => {
      document.getAnimations({ subtree: true }).forEach((a) => {
        a.currentTime = ms;
        a.pause();
      });
      const timer = document.querySelector('.timer');
      if (timer) timer.textContent = `${Math.max(0, Math.ceil(20 - ms / 1000))}s`;
    }, tMs);

    const name = `frame_${String(i).padStart(5, '0')}.png`;
    await page.screenshot({
      path: join(FRAMES, name),
      type: 'png',
      clip: { x: 0, y: 0, width: W, height: H },
    });
    if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${total} (${(i / fps).toFixed(0)}s)`);
  }
  process.stdout.write(`\r  frame ${total}/${total} done          \n`);
  await browser.close();
}

function encode(ffmpeg) {
  const framePattern = join(FRAMES, 'frame_%05d.png').replace(/\\/g, '/');
  const outSilent = join(DIR, 'viralrefer-growth-reel-24h-9x16.mp4');
  const thumb = join(DIR, 'viralrefer-growth-reel-24h-thumb.jpg');
  const hasMusic = existsSync(MUSIC);

  const videoArgs = [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    framePattern,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '19',
    '-preset',
    'medium',
    '-movflags',
    '+faststart',
    '-t',
    String(DURATION_SEC),
  ];

  if (hasMusic) {
    const silent = join(DIR, '.reel-tmp/silent.mp4');
    mkdirSync(join(DIR, '.reel-tmp'), { recursive: true });
    run(ffmpeg, [...videoArgs, silent], 'Encode silent reel');
    run(
      ffmpeg,
      [
        '-y',
        '-i',
        silent,
        '-i',
        MUSIC,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        '-t',
        String(DURATION_SEC),
        '-movflags',
        '+faststart',
        outSilent,
      ],
      'Mux music → growth reel',
    );
  } else {
    run(ffmpeg, [...videoArgs, outSilent], 'Encode growth reel (no music)');
  }

  // Thumbnail from mid frame
  const mid = join(FRAMES, `frame_${String(Math.floor((DURATION_SEC * fps) / 2)).padStart(5, '0')}.png`);
  if (existsSync(mid)) {
    run(
      ffmpeg,
      ['-y', '-i', mid, '-q:v', '3', thumb],
      'Write reel thumbnail',
    );
  }

  return outSilent;
}

function distribute(mp4) {
  const desktop = resolve(process.env.USERPROFILE || '', 'Desktop', 'ViralRefer-Growth-24h');
  const downloads = resolve(process.env.USERPROFILE || '', 'Downloads', 'viralrefer-promo');
  mkdirSync(desktop, { recursive: true });
  mkdirSync(downloads, { recursive: true });

  const name = 'viralrefer-growth-reel-24h-9x16.mp4';
  copyFileSync(mp4, join(desktop, name));
  copyFileSync(mp4, join(downloads, name));
  const thumb = join(DIR, 'viralrefer-growth-reel-24h-thumb.jpg');
  if (existsSync(thumb)) {
    copyFileSync(thumb, join(desktop, 'viralrefer-growth-reel-24h-thumb.jpg'));
    copyFileSync(thumb, join(downloads, 'viralrefer-growth-reel-24h-thumb.jpg'));
  }

  const caption = `Last 24 hours on ViralRefer 📈

63 landings · 56 unique visitors worldwide
7 free links claimed · 11 copies · 19 shares
+4 verified referrals · 9 live on the board
18 total verified referrals

Free worldwide referral leaderboard.
No signup. ~30 seconds.
#1 can claim a homepage feature for their site.
No cash prize — pure competition + visibility.

Ranks are still open 👇
https://www.viralrefer.app/?utm_source=facebook&utm_medium=reel&utm_campaign=growth_24h

Open worldwide · 18+ · free forever · skill-based · no purchase necessary

#ViralRefer #Growth #ReferralMarketing #SideHustle #IndieHacker #Marketing #Reels
`;

  writeFileSync(join(DIR, 'REEL-CAPTION.txt'), caption, 'utf8');
  writeFileSync(join(desktop, 'REEL-CAPTION.txt'), caption, 'utf8');
  writeFileSync(join(downloads, 'REEL-CAPTION.txt'), caption, 'utf8');

  console.log('\nDesktop:', desktop);
  console.log('Downloads:', downloads);
  console.log('MP4:', mp4);
}

async function main() {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('ffmpeg not found — install ffmpeg to encode the reel');
  console.log('ffmpeg:', ffmpeg);
  await captureFrames();
  const mp4 = encode(ffmpeg);
  distribute(mp4);
  console.log('\nGrowth reel ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
