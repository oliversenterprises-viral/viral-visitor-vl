import { chromium } from 'playwright';

async function probe(viewport, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(`https://www.viralrefer.app/?v=${Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.click('#hero-get-link-btn');
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        display: s.display,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        inViewport: r.top < window.innerHeight && r.bottom > 0 && r.height > 0,
        fullyIn: r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0,
      };
    };
    const ref = document.getElementById('ref-link');
    const next = document.getElementById('referral-next-step');
    return {
      hasLink: document.documentElement.getAttribute('data-vr-has-link'),
      funnelStep: document.documentElement.getAttribute('data-vr-funnel-guide-step'),
      refValueLen: (ref?.value || '').length,
      refValueSample: (ref?.value || '').slice(0, 60),
      scrollY: Math.round(window.scrollY),
      vh: window.innerHeight,
      copy: rect(document.getElementById('copy-link-btn')),
      nextStep: {
        hidden: next?.classList.contains('hidden'),
        text: next?.innerText || '',
        rect: rect(next),
      },
      shareBlock: rect(document.getElementById('share-power-block')),
      sharePanel: rect(document.getElementById('share-buttons-panel')),
      whatsapp: rect(document.getElementById('share-whatsapp-primary')),
      qr: rect(document.getElementById('referral-qr-block')),
      referralSection: rect(document.getElementById('referral-section')),
      heroBtn: rect(document.getElementById('hero-get-link-btn')),
    };
  });

  await page.screenshot({
    path: `audit-after-get-link-${label}.png`,
    fullPage: false,
  });
  await browser.close();
  return state;
}

const mobile = await probe({ width: 390, height: 844 }, 'mobile');
const desktop = await probe({ width: 1280, height: 800 }, 'desktop');
console.log(JSON.stringify({ mobile, desktop }, null, 2));
