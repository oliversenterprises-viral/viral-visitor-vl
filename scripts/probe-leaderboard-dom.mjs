import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(
  'https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026',
  { waitUntil: 'networkidle', timeout: 45000 },
);
await page.waitForTimeout(2000);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(300);
}
const report = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')]
    .map((e) => e.id)
    .filter((id) => /lead|board|rank|sprint|live|early/i.test(id));
  const t = document.body.innerText;
  return {
    ids,
    hasEarly: /Early Leaderboard/i.test(t),
    hasLive: /\bLIVE\b/i.test(t),
    hasWeekly: /Weekly Sprint/i.test(t),
    hasSeeLb: /See (who.?s on the )?live board|See leaderboard/i.test(t),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
