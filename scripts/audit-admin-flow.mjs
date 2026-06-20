import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

try {
  await page.goto('https://www.viralrefer.app/', { waitUntil: 'networkidle', timeout: 60000 });

  // Open admin password modal
  const adminBtn = page.locator('#admin-btn, button:has-text("ADMIN")').first();
  await adminBtn.click();
  await page.waitForTimeout(500);
  const pwModalVisible = await page.locator('#admin-password-modal').isVisible();
  results.push({ check: 'Password modal opens', pass: pwModalVisible });

  // Submit password
  await page.fill('#admin-password-input', 'nova2026$');
  await page.click('#admin-password-submit-btn');
  await page.waitForTimeout(2500);

  const url = page.url();
  const kickedOut = url.includes('nocache=') || url.includes('?v=') || url.includes('?force=');
  results.push({ check: 'No redirect kick-out after login', pass: !kickedOut, detail: url });

  const adminModalVisible = await page.locator('#admin-modal').isVisible();
  results.push({ check: 'Admin dashboard stays open', pass: adminModalVisible });

  const adminContent = await page.locator('#admin-content').innerText();
  results.push({ check: 'Admin content loaded', pass: adminContent.length > 20, detail: adminContent.slice(0, 80) });

  // Tab smoke tests
  for (const [tab, label] of [[1, 'Share'], [2, 'Edit'], [3, 'Prize'], [4, 'Colors']]) {
    await page.click(`#tab-${tab}`);
    await page.waitForTimeout(1500);
    const text = await page.locator('#admin-content').innerText();
    const crashed = /error loading|crash|undefined/i.test(text) && text.length < 30;
    results.push({ check: `Tab ${label} renders`, pass: !crashed && text.length > 10 });
  }
} catch (e) {
  results.push({ check: 'Admin flow', pass: false, detail: e.message });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
console.log('PASS', results.filter((r) => r.pass).length, 'FAIL', results.filter((r) => !r.pass).length);
process.exit(results.some((r) => !r.pass) ? 1 : 0);