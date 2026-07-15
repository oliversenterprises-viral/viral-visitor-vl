/**
 * Render ViralRefer IAB ad banners → public/assets/banners/*.png
 * Usage (from repo root): node scripts/ad-banners/render-ad-banners.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"),
);
const { chromium } = require("playwright");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "public/assets/banners");
const HTML_PATH = path.join(__dirname, "all-sizes.html");

/** Standard + high-demand placement sizes */
const SIZES = [
  { id: "728x90", w: 728, h: 90, layout: "leaderboard" },
  { id: "468x60", w: 468, h: 60, layout: "fullbanner" },
  { id: "320x50", w: 320, h: 50, layout: "mobile" },
  { id: "320x100", w: 320, h: 100, layout: "mobilelg" },
  { id: "300x250", w: 300, h: 250, layout: "mpu" },
  { id: "160x600", w: 160, h: 600, layout: "sky" },
  { id: "300x600", w: 300, h: 600, layout: "halfpage" },
  { id: "250x250", w: 250, h: 250, layout: "square" },
  { id: "970x90", w: 970, h: 90, layout: "superboard" },
  { id: "970x250", w: 970, h: 250, layout: "billboard" },
  { id: "851x315", w: 851, h: 315, layout: "cover" },
];

function buildHtml() {
  const cards = SIZES.map(
    (s) => `
  <div class="frame" id="b-${s.id}" data-w="${s.w}" data-h="${s.h}" style="width:${s.w}px;height:${s.h}px">
    ${renderLayout(s)}
  </div>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#111;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .stage{display:flex;flex-direction:column;gap:24px;padding:24px;align-items:flex-start}
  .frame{
    position:relative;overflow:hidden;color:#fff;
    background:
      radial-gradient(ellipse 70% 120% at 8% 50%, rgba(124,58,237,.48) 0%, transparent 58%),
      radial-gradient(ellipse 50% 100% at 92% 60%, rgba(6,182,212,.14) 0%, transparent 55%),
      linear-gradient(135deg,#07060f 0%,#0c0a18 45%,#080812 100%);
  }
  .frame::before{
    content:"";position:absolute;inset:0;pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
    background-size:28px 28px;
    mask-image:radial-gradient(ellipse 85% 90% at 50% 50%,#000 15%,transparent 88%);
  }
  .frame::after{
    content:"";position:absolute;top:0;left:0;right:0;height:2px;z-index:3;
    background:linear-gradient(90deg,#7c3aed,#a78bfa 40%,#22d3ee);
  }
  .inner{position:relative;z-index:2;width:100%;height:100%;display:flex;align-items:center}
  .mark{
    flex-shrink:0;display:grid;place-items:center;font-weight:800;color:#fff;
    background:linear-gradient(145deg,#a78bfa 0%,#7c3aed 55%,#6d28d9 100%);
    box-shadow:0 0 0 1px rgba(255,255,255,.18) inset,0 6px 16px rgba(124,58,237,.4);
    letter-spacing:-.04em;
  }
  .brand{font-weight:800;letter-spacing:-.03em;color:#fff;white-space:nowrap}
  .brand .dot{color:#67e8f9}
  .headline{font-weight:800;letter-spacing:-.035em;line-height:1.08}
  .headline .grad{
    background:linear-gradient(90deg,#e9d5ff,#c4b5fd 40%,#67e8f9);
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .sub{color:rgba(226,232,240,.78);font-weight:500;line-height:1.35}
  .cta{
    display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
    border-radius:999px;font-weight:800;color:#fff;white-space:nowrap;
    background:linear-gradient(135deg,#8b5cf6,#7c3aed 50%,#6d28d9);
    border:1px solid rgba(255,255,255,.16);
    box-shadow:0 8px 20px rgba(109,40,217,.4);
  }
  .url{font-weight:700;color:#c4b5fd;white-space:nowrap}
  .url span{color:#67e8f9}
  .pill{
    display:inline-flex;align-items:center;gap:5px;
    border-radius:999px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    background:rgba(16,185,129,.08);border:1px solid rgba(52,211,153,.35);color:#6ee7b7;
  }
  .pill .d{width:5px;height:5px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399}
  .card{
    border-radius:14px;background:rgba(12,12,20,.72);border:1px solid rgba(255,255,255,.1);
    box-shadow:0 16px 32px rgba(0,0,0,.4);
  }
  .row{display:flex;align-items:center;gap:8px;border-radius:10px;
    background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
  .row.gold{background:linear-gradient(90deg,rgba(234,179,8,.16),rgba(234,179,8,.05));
    border-color:rgba(250,204,21,.45)}
  .rk{display:grid;place-items:center;font-weight:800;border-radius:8px;flex-shrink:0}
  .rk1{background:#facc15;color:#1a1400}
  .rk2{background:#7c3aed;color:#fff}
  .rk3{background:#4c1d95;color:#e9d5ff}
  .nm{font-weight:700;color:#f8fafc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .st{font-weight:700;flex-shrink:0}
  .st.climb{color:#fbbf24}.st.open{color:rgba(148,163,184,.95)}
  .foot{text-align:center;font-weight:600;color:#34d399}

  /* —— layouts —— */
  .inner.L-leaderboard,.inner.L-fullbanner,.inner.L-mobile,.inner.L-superboard{
    flex-direction:row;padding:0 14px;gap:12px;
  }
  .L-leaderboard .mark{width:40px;height:40px;border-radius:11px;font-size:18px}
  .L-leaderboard .brand{font-size:16px}
  .L-leaderboard .headline{font-size:17px;flex:1;min-width:0}
  .L-leaderboard .cta{height:36px;padding:0 16px;font-size:13px}
  .L-leaderboard .url{font-size:13px}

  .L-superboard .mark{width:44px;height:44px;border-radius:12px;font-size:20px}
  .L-superboard .brand{font-size:18px}
  .L-superboard .headline{font-size:22px;flex:1}
  .L-superboard .cta{height:40px;padding:0 20px;font-size:14px}
  .L-superboard .url{font-size:15px}
  .L-superboard .pill{font-size:10px;padding:4px 10px}

  .inner.L-fullbanner{padding:0 10px;gap:8px}
  .L-fullbanner .mark{width:32px;height:32px;border-radius:9px;font-size:14px}
  .L-fullbanner .brand{font-size:13px}
  .L-fullbanner .headline{font-size:12.5px;flex:1;line-height:1.15}
  .L-fullbanner .cta{height:28px;padding:0 12px;font-size:11px}
  .L-fullbanner .url{font-size:11px}

  .inner.L-mobile{padding:0 8px;gap:6px}
  .L-mobile .mark{width:28px;height:28px;border-radius:8px;font-size:12px}
  .L-mobile .brand{font-size:11px}
  .L-mobile .headline{font-size:11px;flex:1;line-height:1.1}
  .L-mobile .cta{height:26px;padding:0 10px;font-size:10px}

  .inner.L-mobilelg{flex-direction:column;justify-content:center;padding:10px 12px;gap:6px;align-items:stretch}
  .L-mobilelg .top{display:flex;align-items:center;gap:8px}
  .L-mobilelg .mark{width:28px;height:28px;border-radius:8px;font-size:13px}
  .L-mobilelg .brand{font-size:13px}
  .L-mobilelg .headline{font-size:14px}
  .L-mobilelg .bot{display:flex;align-items:center;gap:8px}
  .L-mobilelg .cta{height:28px;padding:0 12px;font-size:11px}
  .L-mobilelg .url{font-size:11px}

  .inner.L-mpu,.inner.L-square{
    flex-direction:column;justify-content:center;align-items:flex-start;padding:18px 16px;gap:10px;
  }
  .L-mpu .mark,.L-square .mark{width:36px;height:36px;border-radius:11px;font-size:16px}
  .L-mpu .brand,.L-square .brand{font-size:15px}
  .L-mpu .top,.L-square .top{display:flex;align-items:center;gap:10px}
  .L-mpu .headline{font-size:20px}
  .L-square .headline{font-size:17px}
  .L-mpu .sub{font-size:11.5px}
  .L-square .sub{font-size:11px}
  .L-mpu .cta,.L-square .cta{height:34px;padding:0 14px;font-size:12.5px}
  .L-mpu .url,.L-square .url{font-size:12px}
  .L-mpu .pill,.L-square .pill{font-size:9px;padding:3px 8px}

  .inner.L-sky{
    flex-direction:column;justify-content:flex-start;align-items:center;
    padding:20px 12px;gap:14px;text-align:center;
  }
  .L-sky .mark{width:48px;height:48px;border-radius:14px;font-size:22px}
  .L-sky .brand{font-size:14px}
  .L-sky .headline{font-size:16px}
  .L-sky .sub{font-size:11px}
  .L-sky .cta{height:36px;padding:0 12px;font-size:12px;width:100%}
  .L-sky .url{font-size:11px}
  .L-sky .pill{font-size:8px;padding:3px 7px}
  .L-sky .card{width:100%;padding:10px 8px}
  .L-sky .row{padding:7px 6px;margin-bottom:5px}
  .L-sky .rk{width:22px;height:22px;font-size:9px}
  .L-sky .nm{font-size:10px}
  .L-sky .st{font-size:9px}
  .L-sky .foot{font-size:9px;margin-top:6px}
  .L-sky .card-label{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
    color:rgba(148,163,184,.9);margin-bottom:6px}

  .inner.L-halfpage{
    flex-direction:column;justify-content:center;padding:28px 20px;gap:14px;align-items:flex-start;
  }
  .L-halfpage .top{display:flex;align-items:center;gap:12px}
  .L-halfpage .mark{width:44px;height:44px;border-radius:13px;font-size:20px}
  .L-halfpage .brand{font-size:18px}
  .L-halfpage .pill{font-size:10px;padding:4px 10px}
  .L-halfpage .headline{font-size:26px}
  .L-halfpage .sub{font-size:13px}
  .L-halfpage .cta{height:40px;padding:0 18px;font-size:14px}
  .L-halfpage .url{font-size:14px}
  .L-halfpage .card{width:100%;padding:12px;margin-top:4px}
  .L-halfpage .card-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
    color:rgba(148,163,184,.9);margin-bottom:8px}
  .L-halfpage .row{padding:9px 10px;margin-bottom:6px}
  .L-halfpage .rk{width:26px;height:26px;font-size:10px}
  .L-halfpage .nm{font-size:12px}
  .L-halfpage .st{font-size:10px}
  .L-halfpage .foot{font-size:11px;margin-top:8px}

  .inner.L-billboard{padding:24px 32px;gap:24px}
  .L-billboard .left{flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px;min-width:0}
  .L-billboard .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .L-billboard .mark{width:42px;height:42px;border-radius:12px;font-size:19px}
  .L-billboard .brand{font-size:20px}
  .L-billboard .pill{font-size:11px;padding:5px 11px}
  .L-billboard .headline{font-size:32px}
  .L-billboard .sub{font-size:14px;max-width:480px}
  .L-billboard .cta-row{display:flex;align-items:center;gap:14px}
  .L-billboard .cta{height:42px;padding:0 20px;font-size:14px}
  .L-billboard .url{font-size:15px}
  .L-billboard .card{width:280px;padding:14px;flex-shrink:0}
  .L-billboard .card-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
    color:rgba(148,163,184,.9);margin-bottom:10px}
  .L-billboard .row{padding:9px 11px;margin-bottom:7px}
  .L-billboard .rk{width:28px;height:28px;font-size:11px}
  .L-billboard .nm{font-size:13px}
  .L-billboard .st{font-size:11px}
  .L-billboard .foot{font-size:11px;margin-top:10px}

  .inner.L-cover{padding:28px 32px;gap:18px}
  .L-cover .left{flex:1.15;display:flex;flex-direction:column;justify-content:center;min-width:0}
  .L-cover .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .L-cover .mark{width:36px;height:36px;border-radius:11px;font-size:18px}
  .L-cover .brand{font-size:20px}
  .L-cover .pill{font-size:10.5px;padding:5px 11px}
  .L-cover .headline{font-size:34px;margin-bottom:12px;max-width:460px}
  .L-cover .sub{font-size:13.5px;max-width:430px;margin-bottom:16px}
  .L-cover .cta-row{display:flex;align-items:center;gap:14px}
  .L-cover .cta{height:42px;padding:0 20px;font-size:14.5px}
  .L-cover .url{font-size:15px}
  .L-cover .card{width:100%;max-width:300px;padding:14px}
  .L-cover .card-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
    color:rgba(148,163,184,.9);margin-bottom:10px}
  .L-cover .row{padding:9px 11px;margin-bottom:7px}
  .L-cover .rk{width:28px;height:28px;font-size:11px}
  .L-cover .nm{font-size:13px}
  .L-cover .st{font-size:11px}
  .L-cover .foot{font-size:11px;margin-top:10px}
</style>
</head>
<body>
<div class="stage">
${cards}
</div>
</body>
</html>`;
}

function miniBoard() {
  return `
    <div class="card">
      <div class="card-label">Live leaderboard</div>
      <div class="row gold"><div class="rk rk1">#1</div><div class="nm">Your name here</div><div class="st climb">Climbing</div></div>
      <div class="row"><div class="rk rk2">#2</div><div class="nm">Share &amp; rise</div><div class="st open">Open</div></div>
      <div class="row"><div class="rk rk3">#3</div><div class="nm">Join free</div><div class="st open">Open</div></div>
      <div class="foot">Homepage feature for verified #1</div>
    </div>`;
}

function renderLayout(s) {
  const mark = `<div class="mark">V</div>`;
  const brand = `<div class="brand">viralrefer<span class="dot">.app</span></div>`;
  const brandName = `<div class="brand">ViralRefer</div>`;
  const pill = `<div class="pill"><span class="d"></span> Worldwide · Free · No signup</div>`;
  const cta = `<div class="cta">Get my free link</div>`;
  const url = `<div class="url">viralrefer<span>.app</span></div>`;

  switch (s.layout) {
    case "leaderboard":
    case "superboard":
      return `<div class="inner L-${s.layout}">
        ${mark}${brandName}
        <div class="headline">Free link in 30s. <span class="grad">Climb to #1.</span></div>
        ${s.layout === "superboard" ? pill : ""}
        ${cta}${url}
      </div>`;
    case "fullbanner":
      return `<div class="inner L-fullbanner">
        ${mark}${brandName}
        <div class="headline">Free referral link in 30s · <span class="grad">Climb #1</span></div>
        ${cta}
      </div>`;
    case "mobile":
      return `<div class="inner L-mobile">
        ${mark}
        <div class="headline">Free link · <span class="grad">Climb #1</span></div>
        ${cta}
      </div>`;
    case "mobilelg":
      return `<div class="inner L-mobilelg">
        <div class="top">${mark}${brandName}</div>
        <div class="headline">Get free link in 30s. <span class="grad">Climb to #1.</span></div>
        <div class="bot">${cta}${url}</div>
      </div>`;
    case "mpu":
    case "square":
      return `<div class="inner L-${s.layout}">
        <div class="top">${mark}${brandName}</div>
        ${pill}
        <div class="headline">Get your free link<br/>in 30 seconds.<br/><span class="grad">Climb to #1.</span></div>
        <div class="sub">Live worldwide leaderboard. No signup.</div>
        ${cta}${url}
      </div>`;
    case "sky":
      return `<div class="inner L-sky">
        ${mark}${brandName}${pill}
        <div class="headline">Free link<br/>in 30s.<br/><span class="grad">Climb #1.</span></div>
        <div class="sub">No signup. Live board worldwide.</div>
        ${miniBoard()}
        ${cta}${url}
      </div>`;
    case "halfpage":
      return `<div class="inner L-halfpage">
        <div class="top">${mark}${brandName}</div>
        ${pill}
        <div class="headline">Get your free link in 30 seconds.<br/><span class="grad">Climb to #1.</span></div>
        <div class="sub">Live referral leaderboard. Open worldwide. #1 claims a homepage feature — free recognition, no cash prize.</div>
        <div style="display:flex;align-items:center;gap:12px">${cta}${url}</div>
        ${miniBoard()}
      </div>`;
    case "billboard":
      return `<div class="inner L-billboard">
        <div class="left">
          <div class="top">${mark}${brandName}${pill}</div>
          <div class="headline">Get your free link in 30 seconds.<br/><span class="grad">Climb to #1.</span></div>
          <div class="sub">Live referral leaderboard. Open worldwide. #1 claims a homepage feature — free recognition, no cash prize.</div>
          <div class="cta-row">${cta}${url}</div>
        </div>
        ${miniBoard()}
      </div>`;
    case "cover":
      return `<div class="inner L-cover">
        <div class="left">
          <div class="top">${mark}${brandName}${pill}</div>
          <div class="headline">Get your free link in 30 seconds.<br/><span class="grad">Climb to #1.</span></div>
          <div class="sub">Live referral leaderboard. Open worldwide. #1 claims a homepage feature for their site — free recognition, no cash prize.</div>
          <div class="cta-row">${cta}${url}</div>
        </div>
        <div style="display:flex;align-items:center">${miniBoard()}</div>
      </div>`;
    default:
      return `<div class="inner">${brand}</div>`;
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(HTML_PATH, buildHtml(), "utf8");

const fileUrl = "file:///" + HTML_PATH.replace(/\\/g, "/");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];

try {
  for (const s of SIZES) {
    const page = await browser.newPage({
      viewport: { width: s.w + 40, height: s.h + 40 },
      deviceScaleFactor: 1,
    });
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(400);
    const outName = `viralrefer-${s.id}.png`;
    const outPath = path.join(OUT_DIR, outName);
    await page.locator(`#b-${s.id}`).screenshot({ path: outPath, type: "png" });
    await page.close();
    const bytes = fs.statSync(outPath).size;
    results.push({ id: s.id, file: outName, bytes, path: outPath });
    console.log(`OK ${s.id} → ${outName} (${bytes} bytes)`);
  }

  // Keep legacy PageRankCafe filename as alias of 851x315
  const src851 = path.join(OUT_DIR, "viralrefer-851x315.png");
  const legacy = path.join(OUT_DIR, "viralrefer-851x315-pagerankcafe.png");
  if (fs.existsSync(src851)) {
    fs.copyFileSync(src851, legacy);
    console.log("OK alias viralrefer-851x315-pagerankcafe.png");
  }

  // Live URL index (deployed with assets)
  const urls = [
    "# ViralRefer ad banners — hotlink from viralrefer.app",
    "# Updated: " + new Date().toISOString().slice(0, 10),
    "# Destination (iframe exchanges e.g. PageRankCafe): https://www.viralrefer.app/embed?utm_source=NETWORK&utm_medium=banner&utm_campaign=SIZE",
    "# Destination (full page / non-iframe): https://www.viralrefer.app/?utm_source=NETWORK&utm_medium=banner&utm_campaign=SIZE",
    "",
    ...SIZES.map(
      (s) =>
        `https://www.viralrefer.app/assets/banners/viralrefer-${s.id}.png  # ${s.w}x${s.h}`,
    ),
    "https://www.viralrefer.app/assets/banners/viralrefer-851x315-pagerankcafe.png  # alias of 851x315",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "URLS.txt"), urls, "utf8");
  console.log(JSON.stringify({ ok: true, count: results.length, out: OUT_DIR }, null, 2));
} finally {
  await browser.close();
}
