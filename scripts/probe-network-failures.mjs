#!/usr/bin/env node
import { chromium } from 'playwright';

const LIVE = 'https://www.viralrefer.app/r/VIRAL-97UWEGZ';
const fails = [];
const responses = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('requestfailed', (req) => {
  fails.push({ url: req.url(), failure: req.failure()?.errorText });
});
page.on('response', (res) => {
  if (res.status() >= 400) {
    responses.push({ url: res.url(), status: res.status() });
  }
});

await page.goto(LIVE, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(12000);

const iframeCount = await page.locator('#referral-turnstile-container iframe').count();
const containerHtml = await page.locator('#referral-turnstile-container').innerHTML().catch(() => '');

await browser.close();

console.log(JSON.stringify({
  iframeCount,
  containerHtmlSnippet: containerHtml.slice(0, 400),
  failedRequests: fails.filter((f) => !f.url.includes('reddit')),
  errorResponses: responses.filter((r) => !r.url.includes('reddit') && !r.url.includes('qrserver')),
}, null, 2));