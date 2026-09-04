/**
 * Isolated Playwright check of Get-link → Send → paste CSS.
 * Injects attrs only. Never sets vr_my_ref_code. Never clicks Send.
 */
import { chromium } from 'playwright';

const BASE = process.env.VR_SMOOTH_URL || 'http://127.0.0.1:5188/';

function vis(page) {
  return page.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id);
      if (!el) return { missing: true };
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        visibility: cs.visibility,
        hidden: el.hidden,
        shown: cs.display !== 'none' && cs.visibility !== 'hidden',
      };
    };
    return {
      attrs: {
        hasLink: document.documentElement.hasAttribute('data-vr-has-link'),
        didSend: document.documentElement.hasAttribute('data-vr-did-send'),
        didPaste: document.documentElement.hasAttribute('data-vr-did-paste'),
      },
      hero: box('hero-get-link-btn'),
      heading: box('post-link-heading'),
      send: box('post-link-primary'),
      paste: box('post-link-site-drop'),
      copy: box('post-link-copy'),
      ticker: box('site-entered-ticker'),
      rungs: box('send-ladder-proof'),
      pasteLabel: document.querySelector('#post-link-site-drop-submit .drop-submit-long')?.textContent || '',
      pasteShort: document.querySelector('#post-link-site-drop-submit .drop-submit-short')?.textContent || '',
      heroLong: document.querySelector('#hero-get-link-btn .hero-cta-long')?.textContent || '',
      heroShort: document.querySelector('#hero-get-link-btn .hero-cta-short')?.textContent || '',
      pasteTs: box('post-link-site-drop-turnstile'),
      friendTs: box('friend-credit-turnstile'),
      pasteTsH: document.getElementById('post-link-site-drop-turnstile')
        ? parseFloat(getComputedStyle(document.getElementById('post-link-site-drop-turnstile')).height)
        : 0,
      friendTsH: document.getElementById('friend-credit-turnstile')
        ? parseFloat(getComputedStyle(document.getElementById('friend-credit-turnstile')).height)
        : 0,
      friendTsPos: document.getElementById('friend-credit-turnstile')
        ? getComputedStyle(document.getElementById('friend-credit-turnstile')).position
        : '',
    };
  });
}

async function paintReady(page) {
  await page.evaluate(() => {
    const html = document.documentElement;
    html.setAttribute('data-vr-has-link', '1');
    html.setAttribute('data-vr-post-link-one', '1');
    html.removeAttribute('data-vr-did-send');
    html.removeAttribute('data-vr-did-paste');
    const section = document.getElementById('referral-section');
    if (section) {
      section.hidden = false;
      section.removeAttribute('hidden');
      section.classList.remove('hidden');
    }
    const share = document.getElementById('post-link-share');
    if (share) {
      share.hidden = false;
      share.removeAttribute('hidden');
      share.classList.remove('hidden');
      share.dataset.state = 'ready';
    }
    const send = document.getElementById('post-link-primary');
    if (send) {
      send.hidden = false;
      send.removeAttribute('hidden');
      send.classList.remove('hidden');
    }
    const paste = document.getElementById('post-link-site-drop');
    if (paste) {
      paste.hidden = false;
      paste.removeAttribute('hidden');
      paste.classList.remove('hidden');
    }
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 playwright vr_test',
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('#hero-get-link-btn', { timeout: 15_000 });

const cold = await vis(page);
await paintReady(page);
const afterLink = await vis(page);

await page.evaluate(() => document.documentElement.setAttribute('data-vr-did-send', '1'));
const afterSend = await vis(page);

await page.evaluate(() => document.documentElement.setAttribute('data-vr-did-paste', '1'));
const afterPaste = await vis(page);

await page.setViewportSize({ width: 1366, height: 800 });
await page.evaluate(() => {
  document.documentElement.removeAttribute('data-vr-did-send');
  document.documentElement.removeAttribute('data-vr-did-paste');
});
const desktopAfterLink = await vis(page);

await page.goto(new URL('/r/VIRAL-SMOOTH1', BASE).href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForSelector('#hero-get-link-btn', { timeout: 15_000 });
const friend = await vis(page);
const friendTitle = await page.locator('#hero-title-line1').textContent();

await browser.close();

const fail = [];
if (!cold.hero.shown) fail.push('cold hero CTA hidden');
if (cold.heroLong.trim() !== 'Get my referral link') fail.push(`hero long locked copy missing: ${cold.heroLong}`);
if (cold.heroShort.trim() !== 'Get my link') fail.push(`hero short locked copy missing: ${cold.heroShort}`);
if (cold.pasteLabel.trim() !== 'Paste your site — 15 min') fail.push(`paste lock missing: ${cold.pasteLabel}`);

if (afterLink.hero.shown) fail.push('after Get-link hero still shown');
if (!afterLink.send.shown) fail.push('after Get-link Send hidden');
if (afterLink.paste.shown) fail.push('after Get-link paste shown (should be Send only)');
if (afterLink.copy.shown) fail.push('after Get-link Copy shown');
if (afterLink.ticker.shown) fail.push('after Get-link ticker shown');
if (afterLink.heading.shown) fail.push('after Get-link heading shown');

if (afterSend.send.shown) fail.push('after Send, Send still shown');
if (!afterSend.paste.shown) fail.push('after Send, paste hidden');
if (afterSend.copy.shown) fail.push('after Send, Copy shown');
if (afterSend.ticker.shown) fail.push('after Send, ticker shown');
if (!(afterSend.pasteTsH >= 60)) fail.push(`after Send, Turnstile not painted (${afterSend.pasteTsH})`);

if (afterPaste.paste.shown) fail.push('after paste, paste form still shown');
if (!afterPaste.send.shown) fail.push('after paste, Send hidden');
if (!afterPaste.rungs.shown) fail.push('after paste, rungs hidden');
if (afterPaste.copy.shown) fail.push('after paste, Copy shown');

if (desktopAfterLink.paste.shown) fail.push('desktop after Get-link paste shown');
if (!desktopAfterLink.send.shown) fail.push('desktop after Get-link Send hidden');

if (!/same race as VIRAL-SMOOTH1/i.test(friendTitle || '')) fail.push(`friend land title: ${friendTitle}`);
if (!friend.hero.shown) fail.push('friend land CTA hidden');
if (friend.friendTsPos !== 'fixed') fail.push(`friend Turnstile not in view (${friend.friendTsPos})`);
if (!(friend.friendTsH >= 60)) fail.push(`friend Turnstile not painted (${friend.friendTsH})`);

const report = { cold, afterLink, afterSend, afterPaste, desktopAfterLink, friendTitle, fail };
console.log(JSON.stringify(report, null, 2));
if (fail.length) {
  console.error('SMOOTHNESS FAIL', fail.join(' | '));
  process.exit(1);
}
console.log('SMOOTHNESS OK');
