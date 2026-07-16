/**
 * Render multi-platform social banners → public/assets/banners/
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
const OUT = path.join(ROOT, "public/assets/banners");
const HTML = path.join(__dirname, "social-universal.html");

const SIZES = [
  { id: "1200x628", w: 1200, h: 628 }, // FB / Reddit / LinkedIn / link previews
  { id: "1280x720", w: 1280, h: 720 }, // Telegram / YouTube / HD
  { id: "1080x1080", w: 1080, h: 1080 }, // IG / FB / Telegram square
  { id: "1080x1920", w: 1080, h: 1920 }, // Stories / Reels / Status
];

fs.mkdirSync(OUT, { recursive: true });
const fileUrl = "file:///" + HTML.replace(/\\/g, "/");
const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  for (const s of SIZES) {
    const page = await browser.newPage({
      viewport: { width: s.w + 48, height: s.h + 48 },
      deviceScaleFactor: 1,
    });
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    const name = `viralrefer-social-${s.id}.png`;
    const dest = path.join(OUT, name);
    await page.locator(`#s-${s.id}`).screenshot({ path: dest, type: "png" });
    await page.close();
    console.log(`OK ${name} (${fs.statSync(dest).size} bytes)`);
  }

  // Clickable HTML banner (for sites that allow HTML embeds)
  const clickable = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ViralRefer — Free referral leaderboard</title>
  <style>
    html,body{margin:0;padding:0;background:transparent}
    a{display:block;line-height:0;text-decoration:none}
    img{width:100%;height:auto;max-width:1200px;border:0;border-radius:12px}
  </style>
</head>
<body>
  <a href="https://www.viralrefer.app/?utm_source=html_banner&utm_medium=banner&utm_campaign=social_universal&utm_content=1200x628"
     target="_blank" rel="noopener noreferrer"
     title="ViralRefer — Get your free link in 30 seconds">
    <img src="https://www.viralrefer.app/assets/banners/viralrefer-social-1200x628.png"
         width="1200" height="628"
         alt="ViralRefer — Free worldwide referral leaderboard. Get your free link in 30 seconds. Climb to #1." />
  </a>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, "viralrefer-clickable-banner.html"), clickable, "utf8");

  // Platform paste pack (deployed + local)
  const guide = `# ViralRefer — Universal social banners (click → viralrefer.app)
Updated: ${new Date().toISOString().slice(0, 10)}

IMPORTANT
- PNG images do not auto-link. When you post, set the destination URL below (or wrap the HTML banner).
- Use homepage links for Facebook / Telegram / Reddit / normal posts.
- Use /embed only for traffic exchanges that load sites inside iframes (e.g. PageRankCafe).

═══════════════════════════════════════
IMAGE SOURCES (hosted on viralrefer.app)
═══════════════════════════════════════
Primary (most places):
https://www.viralrefer.app/assets/banners/viralrefer-social-1200x628.png

HD / Telegram:
https://www.viralrefer.app/assets/banners/viralrefer-social-1280x720.png

Square (IG / FB / Telegram):
https://www.viralrefer.app/assets/banners/viralrefer-social-1080x1080.png

Stories / tall:
https://www.viralrefer.app/assets/banners/viralrefer-social-1080x1920.png

Clickable HTML embed:
https://www.viralrefer.app/assets/banners/viralrefer-clickable-banner.html

Also available IAB sizes:
https://www.viralrefer.app/assets/banners/URLS.txt

═══════════════════════════════════════
CLICK / REDIRECT DESTINATIONS
═══════════════════════════════════════
Facebook post / ad / page:
https://www.viralrefer.app/?utm_source=facebook&utm_medium=social&utm_campaign=social_banner&utm_content=1200x628

Telegram channel / group / bot caption:
https://www.viralrefer.app/?utm_source=telegram&utm_medium=social&utm_campaign=social_banner&utm_content=1280x720

Reddit post (link post) or first comment under image:
https://www.viralrefer.app/?utm_source=reddit&utm_medium=social&utm_campaign=social_banner&utm_content=1200x628

Generic / anywhere else:
https://www.viralrefer.app/?utm_source=social&utm_medium=banner&utm_campaign=social_universal&utm_content=multi

Personal referral share (when YOU are sharing as a participant — not cold ads):
https://www.viralrefer.app/r/VIRAL-97UWEGZ

═══════════════════════════════════════
SUGGESTED CAPTIONS
═══════════════════════════════════════
Short:
Get a free referral link in 30 seconds. Climb the live worldwide board — #1 claims a homepage feature. No signup.

Facebook:
Free worldwide referral leaderboard 🔥
Get your free link in ~30 seconds (no email). Share → climb → #1 can claim a homepage feature.
No cash prize. Open worldwide · 18+.

Reddit (value-first):
Built a free no-signup referral leaderboard. Live board, ~30s to get a trackable link, #1 can claim a homepage feature (no cash prize). Feedback welcome.

Telegram:
ViralRefer — free link in 30s · live leaderboard · climb to #1 for homepage feature.
No signup. Open worldwide.

═══════════════════════════════════════
HOW TO USE BY PLATFORM
═══════════════════════════════════════
Facebook: Create post → add image (1200x628 or 1080x1080) → paste Facebook destination URL in post text or as link attachment.
Telegram: Send photo → put Telegram destination URL in caption.
Reddit: Image post + sticky comment with Reddit destination URL, OR link post pointing at the destination URL with image as thumbnail if allowed.
Anywhere HTML is allowed: open viralrefer-clickable-banner.html source and embed (image already links to site).

Title if needed:
Get a Free Referral Link in 30 Sec · Climb the Live Leaderboard
`;

  fs.writeFileSync(path.join(OUT, "SOCIAL-SHARE.txt"), guide, "utf8");
  fs.writeFileSync(
    path.join(ROOT, "marketing/SOCIAL-SHARE-BANNERS.txt"),
    guide,
    "utf8",
  );

  // Append to URLS.txt if present
  const urlsPath = path.join(OUT, "URLS.txt");
  const extra = [
    "",
    "# Social / multi-platform (2026-07-15+)",
    "https://www.viralrefer.app/assets/banners/viralrefer-social-1200x628.png  # FB Reddit LinkedIn",
    "https://www.viralrefer.app/assets/banners/viralrefer-social-1280x720.png  # Telegram HD",
    "https://www.viralrefer.app/assets/banners/viralrefer-social-1080x1080.png # Square",
    "https://www.viralrefer.app/assets/banners/viralrefer-social-1080x1920.png # Stories",
    "https://www.viralrefer.app/assets/banners/viralrefer-clickable-banner.html # HTML click wrapper",
    "https://www.viralrefer.app/assets/banners/SOCIAL-SHARE.txt  # full paste guide",
    "",
  ].join("\n");
  if (fs.existsSync(urlsPath)) {
    let cur = fs.readFileSync(urlsPath, "utf8");
    if (!cur.includes("viralrefer-social-1200x628")) {
      fs.writeFileSync(urlsPath, cur.trimEnd() + "\n" + extra, "utf8");
    }
  } else {
    fs.writeFileSync(urlsPath, extra, "utf8");
  }

  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2));
} finally {
  await browser.close();
}
