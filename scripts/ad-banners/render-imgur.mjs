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
const OUT = path.join(ROOT, "marketing/imgur");
const HTML = path.join(__dirname, "imgur-viral.html");

fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { id: "hero", w: 1200, h: 675, file: "imgur-01-hero-1200x675.png" },
  { id: "steps", w: 1200, h: 675, file: "imgur-02-how-it-works-1200x675.png" },
  { id: "sq", w: 1080, h: 1080, file: "imgur-03-square-1080.png" },
];

const fileUrl = "file:///" + HTML.replace(/\\/g, "/");
const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  for (const s of SIZES) {
    const page = await browser.newPage({
      viewport: { width: s.w + 40, height: s.h + 40 },
      deviceScaleFactor: 1,
    });
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    const dest = path.join(OUT, s.file);
    await page.locator(`#${s.id}`).screenshot({ path: dest, type: "png" });
    await page.close();
    console.log("OK", s.file, fs.statSync(dest).size);
  }
  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2));
} finally {
  await browser.close();
}
