import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"),
);
const { chromium } = require("playwright");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(__dirname, "growth-card-x.html");
const out = path.join(
  __dirname,
  "../../marketing/x-launch/viralrefer-growth-card-1200x675.png",
);
const outPublic = path.join(
  __dirname,
  "../../public/assets/banners/viralrefer-growth-card-1200x675.png",
);

const fileUrl = "file:///" + html.replace(/\\/g, "/");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 675 },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.locator("#card").screenshot({ path: out, type: "png" });
  await page.locator("#card").screenshot({ path: outPublic, type: "png" });
  console.log("OK", out);
} finally {
  await browser.close();
}
