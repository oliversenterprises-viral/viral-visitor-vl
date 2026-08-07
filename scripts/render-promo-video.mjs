#!/usr/bin/env node
/**
 * Re-render marketing promo MP4s from marketing/video-promo/promo-60s.html
 * (worldwide / no-cash source). Outputs: 9:16, 16:9, 1:1 + thumbnail.
 *
 *   node scripts/render-promo-video.mjs
 *   node scripts/render-promo-video.mjs --fps 12
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
const PROMO_DIR = resolve(ROOT, 'marketing/video-promo');
const HTML = resolve(PROMO_DIR, 'promo-60s.html');
const MUSIC = resolve(PROMO_DIR, 'promo-music.mp3');
const FRAMES = resolve(PROMO_DIR, '.record-tmp/frames');
const DURATION_SEC = 60;
const W = 1080;
const H = 1920;

const args = process.argv.slice(2);
const fps = Number(args.find((a, i) => args[i - 1] === '--fps') || 12);

function findFfmpeg() {
  const candidates = [
    'ffmpeg',
    join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    join(process.env.ProgramFiles || '', 'ffmpeg/bin/ffmpeg.exe'),
  ];
  try {
    const which = execSync('where.exe ffmpeg', { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (which && existsSync(which)) return which;
  } catch {
    /* continue */
  }
  // Winget Gyan.FFmpeg often lands under LocalAppData\Microsoft\WinGet\Packages
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

async function captureFrames(ffmpegPath) {
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
  // Wait for webfonts / QR image
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // Pause all CSS animations so we can scrub with currentTime
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
      // Timer label
      const timer = document.querySelector('.timer');
      if (timer) timer.textContent = `${Math.max(0, Math.ceil(60 - ms / 1000))}s`;
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
  return ffmpegPath;
}

function encodeAll(ffmpeg) {
  const framePattern = join(FRAMES, 'frame_%05d.png').replace(/\\/g, '/');
  const out9 = join(PROMO_DIR, 'viralrefer-promo-60s-9x16.mp4');
  const out16 = join(PROMO_DIR, 'viralrefer-promo-60s-16x9.mp4');
  const out1 = join(PROMO_DIR, 'viralrefer-promo-60s-1x1.mp4');
  const thumb = join(PROMO_DIR, 'viralrefer-promo-thumbnail.jpg');
  const silent9 = join(PROMO_DIR, '.record-tmp/silent-9x16.mp4');

  const hasMusic = existsSync(MUSIC);

  // 9:16 master (silent first if we'll mux audio)
  const videoArgs = [
    '-y',
    '-framerate', String(fps),
    '-i', framePattern,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '20',
    '-preset', 'medium',
    '-movflags', '+faststart',
    '-t', String(DURATION_SEC),
  ];

  if (hasMusic) {
    run(ffmpeg, [...videoArgs, silent9], 'Encode silent 9:16');
    run(
      ffmpeg,
      [
        '-y',
        '-i', silent9,
        '-i', MUSIC,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-t', String(DURATION_SEC),
        '-movflags', '+faststart',
        out9,
      ],
      'Mux audio → 9:16',
    );
  } else {
    run(ffmpeg, [...videoArgs, out9], 'Encode 9:16 (no music)');
  }

  // 16:9 — letterbox center crop from 9:16 (scale height to 1080, pad width)
  // Prefer crop center of vertical video into 16:9 frame
  run(
    ffmpeg,
    [
      '-y',
      '-i', out9,
      '-vf',
      // Scale to height 1080, then crop width to 1920 if needed, or pad to 1920x1080
      "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      '-preset', 'medium',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      out16,
    ],
    'Encode 16:9',
  );

  // 1:1 — center crop square from 9:16
  run(
    ffmpeg,
    [
      '-y',
      '-i', out9,
      '-vf', 'crop=1080:1080:0:420',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      '-preset', 'medium',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      out1,
    ],
    'Encode 1:1',
  );

  // Thumbnail from ~2s into scene 1 (FREE / worldwide visible)
  const thumbFrame = join(FRAMES, `frame_${String(Math.floor(2 * fps)).padStart(5, '0')}.png`);
  if (existsSync(thumbFrame)) {
    run(
      ffmpeg,
      ['-y', '-i', thumbFrame, '-frames:v', '1', '-update', '1', '-q:v', '3', thumb],
      'Thumbnail JPG',
    );
  }

  // Also write tmp-audio copies for backwards-compat with old naming
  for (const [src, dest] of [
    [out9, join(PROMO_DIR, 'viralrefer-promo-60s-9x16.tmp-audio.mp4')],
    [out16, join(PROMO_DIR, 'viralrefer-promo-60s-16x9.tmp-audio.mp4')],
    [out1, join(PROMO_DIR, 'viralrefer-promo-60s-1x1.tmp-audio.mp4')],
  ]) {
    if (existsSync(src)) copyFileSync(src, dest);
  }

  console.log('\n=== Promo render complete ===');
  console.log(`  ${out9}`);
  console.log(`  ${out16}`);
  console.log(`  ${out1}`);
  console.log(`  ${thumb}`);
}

async function main() {
  console.log('=== ViralRefer promo re-render (worldwide / no-cash) ===');
  let ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.log('ffmpeg not found — attempting winget install…');
    const r = spawnSync(
      'winget',
      ['install', '--id', 'Gyan.FFmpeg', '-e', '--accept-source-agreements', '--accept-package-agreements'],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) {
      throw new Error('ffmpeg not installed. Install with: winget install Gyan.FFmpeg');
    }
    // Refresh PATH for this process is limited; search disk
    ffmpeg = findFfmpeg();
  }
  if (!ffmpeg) throw new Error('ffmpeg still not found after install');
  console.log(`ffmpeg: ${ffmpeg}`);

  await captureFrames(ffmpeg);
  encodeAll(ffmpeg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
