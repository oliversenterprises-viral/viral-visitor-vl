/**
 * Promo Kit — marketing assets for locked referrers only.
 * Gate: html[data-vr-share-locked] (first friend completed Get my link).
 * Does not change referral recording or lock rules.
 *
 * v2: QR-stamped banner downloads, unlock confetti toast,
 * X-safe captions (no viralrefer.app / http URLs — X malware filter).
 */

import { getMyReferralCode, getReferralBaseUrl } from '../public/globals';
import { registerGlobal } from './global';
import { showToast } from '../ui';
import { trackViralLoopEvent } from './visitor-tracking';
import { buildQrImageUrl } from './share-power';
import { downloadCanvasPng } from './share-cards';

/** Same-origin path preferred so canvas is not tainted when compositing. */
const BANNER_PATH = '/assets/banners';
const BANNER_BASE_ABS = 'https://www.viralrefer.app/assets/banners';
const TELEGRAM_BOT = 'https://t.me/myviralreferbot';
const UNLOCK_CELEBRATED_KEY = 'vr_promo_kit_unlock_celebrated';

export type PromoBannerSpec = {
  id: string;
  label: string;
  file: string;
  size: string;
};

/** Hosted static creatives; downloads get personal QR stamped on. */
export const PROMO_BANNERS: PromoBannerSpec[] = [
  { id: '1200x628', label: 'Social (FB / Reddit)', file: 'viralrefer-social-1200x628.png', size: '1200×628' },
  { id: '1080x1080', label: 'Square / X image', file: 'viralrefer-social-1080x1080.png', size: '1080×1080' },
  { id: '1280x720', label: 'HD / Telegram', file: 'viralrefer-social-1280x720.png', size: '1280×720' },
  { id: '1080x1920', label: 'Story', file: 'viralrefer-social-1080x1920.png', size: '1080×1920' },
  { id: '728x90', label: 'Leaderboard ad', file: 'viralrefer-728x90.png', size: '728×90' },
  { id: '300x250', label: 'Medium rectangle', file: 'viralrefer-300x250.png', size: '300×250' },
];

export function isPromoKitUnlocked(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-share-locked');
}

export function hasPromoKitLinkReady(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-has-link');
}

export function buildPersonalPromoLink(code: string, content = 'promo_kit'): string | null {
  const c = String(code || '').trim().toUpperCase();
  if (!/^VIRAL-[A-Z0-9]+$/.test(c)) return null;
  const base = (getReferralBaseUrl() || 'https://www.viralrefer.app').replace(/\/$/, '');
  const u = new URL(`${base}/r/${c}`);
  u.searchParams.set('utm_source', 'promo_kit');
  u.searchParams.set('utm_medium', 'share');
  u.searchParams.set('utm_campaign', 'locked_referrer');
  u.searchParams.set('utm_content', content);
  return u.toString();
}

/**
 * Captions for promo kit.
 * xSafe / any X-bound copy: NO domain, NO http(s) URL (X flags viralrefer.app).
 * Direct users to the QR on the image + Google: ViralRefer.
 */
export function buildPromoCaptions(personalLink: string, code?: string): {
  short: string;
  long: string;
  xSafe: string;
} {
  const codeHint = code && /^VIRAL-/i.test(code) ? code.toUpperCase() : '';
  return {
    short: `Get a free ViralRefer link in ~30 seconds. No signup. Climb the live board — #1 can claim a homepage feature.\n\n${personalLink}`,
    long: `I locked my spot on ViralRefer (free worldwide referral leaderboard).\n\n• Free link in ~30 seconds\n• No email / no signup\n• #1 claims a homepage feature (no cash prize)\n• Open worldwide · 18+\n\nJoin with my link:\n${personalLink}`,
    xSafe: buildXSafePromoCaption(codeHint),
  };
}

/** Pure X caption builder — never includes domain or http(s) links. */
export function buildXSafePromoCaption(code = ''): string {
  const codeLine = code ? `\nCode on image: ${code}` : '';
  return (
    `Live free referral leaderboard on ViralRefer 🏆` +
    `\nNo signup · ~30 sec · #1 can claim a homepage feature (no cash prize).` +
    `\nScan the QR on my image — or search Google: ViralRefer` +
    codeLine
  );
}

/** True if text is safe for X (no domain/url that triggers link filter). */
export function isXAlgorithmSafeCaption(text: string): boolean {
  const t = String(text || '');
  if (/https?:\/\//i.test(t)) return false;
  if (/viralrefer\.app/i.test(t)) return false;
  if (/\bx\.com\//i.test(t)) return false;
  if (/t\.co\//i.test(t)) return false;
  return true;
}

/**
 * Resolve caption kind: force xSafe when caller asks for X or labels mention X.
 */
export function resolvePromoCaptionKind(
  kind: string | undefined,
): 'short' | 'long' | 'xSafe' {
  const k = String(kind || 'short').toLowerCase();
  if (k === 'long') return 'long';
  if (k === 'xsafe' || k === 'x' || k === 'twitter' || k.includes('x')) return 'xSafe';
  return 'short';
}

export function bannerUrl(file: string): string {
  return `${BANNER_BASE_ABS}/${file}`;
}

/** Prefer same-origin for canvas composite downloads. */
export function bannerUrlForCanvas(file: string): string {
  if (typeof location !== 'undefined' && location.origin) {
    return `${location.origin}${BANNER_PATH}/${file}`;
  }
  return bannerUrl(file);
}

function resolveCode(): string | null {
  const code = getMyReferralCode() || localStorage.getItem('vr_my_ref_code');
  const c = String(code || '').trim().toUpperCase();
  return /^VIRAL-[A-Z0-9]+$/.test(c) ? c : null;
}

async function copyText(text: string, okMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMsg, 'success');
  } catch {
    showToast('Could not copy — select and copy manually', 'info');
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`image load failed: ${src}`));
    el.src = src;
  });
}

/**
 * Composite banner + personal QR (bottom-right) + code strip; download PNG.
 * Falls back to opening raw banner if composite fails.
 */
export async function downloadPromoBannerWithQr(
  spec: PromoBannerSpec,
  personalLink: string,
  code: string,
): Promise<boolean> {
  try {
    const banner = await loadImage(bannerUrlForCanvas(spec.file));
    const w = banner.naturalWidth || banner.width;
    const h = banner.naturalHeight || banner.height;
    if (!w || !h) return false;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(banner, 0, 0, w, h);

    // QR size: ~16% of shorter side, min 72, max 220
    const shortSide = Math.min(w, h);
    const qrSize = Math.round(Math.min(220, Math.max(72, shortSide * 0.16)));
    const pad = Math.round(qrSize * 0.12);
    const box = qrSize + pad * 2;
    const x = w - box - Math.round(Math.max(8, w * 0.02));
    const y = h - box - Math.round(Math.max(8, h * 0.02));

    // White plate + thin border
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    const r = Math.min(12, pad);
    roundRectPath(ctx, x, y, box, box, r);
    ctx.fill();
    ctx.stroke();

    const qrUrl = buildQrImageUrl(personalLink, Math.min(512, qrSize * 2));
    const qrImg = await loadImage(qrUrl);
    ctx.drawImage(qrImg, x + pad, y + pad, qrSize, qrSize);

    // Code chip above QR plate when height allows
    if (h > 120) {
      const chip = code;
      ctx.font = `bold ${Math.max(11, Math.round(qrSize * 0.14))}px ui-monospace, monospace`;
      const tw = ctx.measureText(chip).width;
      const chipH = Math.round(qrSize * 0.22);
      const chipW = tw + 16;
      const chipX = x + box - chipW;
      const chipY = Math.max(4, y - chipH - 4);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
      roundRectPath(ctx, chipX, chipY, chipW, chipH, 6);
      ctx.fill();
      ctx.fillStyle = '#042f2e';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip, chipX + 8, chipY + chipH / 2);
      ctx.textBaseline = 'alphabetic';
    }

    downloadCanvasPng(canvas, `viralrefer-promo-${code}-${spec.id}-qr.png`);
    return true;
  } catch {
    return false;
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Confetti + toast once per browser when kit first unlocks. */
export function celebratePromoKitUnlock(): void {
  if (!isPromoKitUnlocked()) return;
  try {
    if (sessionStorage.getItem(UNLOCK_CELEBRATED_KEY) === '1') return;
    sessionStorage.setItem(UNLOCK_CELEBRATED_KEY, '1');
  } catch {
    /* still celebrate once if storage blocked */
  }

  showToast('Promo Kit unlocked — banners with your QR are ready!', 'success');
  trackViralLoopEvent('PromoKitUnlocked', {});

  void import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 72,
        spread: 78,
        origin: { y: 0.65 },
        colors: ['#34d399', '#a78bfa', '#22d3ee', '#fbbf24'],
      });
      window.setTimeout(() => {
        confetti({
          particleCount: 36,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#34d399', '#a78bfa'],
        });
        confetti({
          particleCount: 36,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#22d3ee', '#fbbf24'],
        });
      }, 200);
    })
    .catch(() => {});
}

let wasUnlocked = false;

export function syncPromoKitUI(): void {
  const kit = document.getElementById('promo-kit');
  const teaser = document.getElementById('promo-kit-teaser');
  if (!kit && !teaser) return;

  const unlocked = isPromoKitUnlocked();
  const hasLink = hasPromoKitLinkReady();

  if (kit) {
    kit.classList.toggle('hidden', !unlocked);
    kit.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
  }
  if (teaser) {
    const showTeaser = hasLink && !unlocked;
    teaser.classList.toggle('hidden', !showTeaser);
    teaser.setAttribute('aria-hidden', showTeaser ? 'false' : 'true');
  }

  // Rising edge → celebrate
  if (unlocked && !wasUnlocked) {
    celebratePromoKitUnlock();
  }
  wasUnlocked = unlocked;

  if (!unlocked) return;

  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, 'kit_panel') : null;
  const linkEl = document.getElementById('promo-kit-personal-link');
  const codeEl = document.getElementById('promo-kit-code');
  if (codeEl) codeEl.textContent = code || '—';
  if (linkEl) {
    if (link) {
      linkEl.textContent = link;
      (linkEl as HTMLAnchorElement).href = link;
    } else {
      linkEl.textContent = 'Get your link first, then lock it with a friend.';
    }
  }

  const xHint = document.getElementById('promo-kit-x-hint');
  if (xHint) {
    xHint.textContent =
      'X tip: use “X-safe caption” (no links) + download a QR banner so the domain never hits X’s filter.';
  }
}

export function copyPromoCaption(kind: string = 'short'): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const resolved = resolvePromoCaptionKind(kind);
  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, `caption_${resolved}`) : null;
  if (!link) {
    showToast('Your referral code is missing — refresh and try again', 'info');
    return;
  }
  const caps = buildPromoCaptions(link, code || undefined);
  let text = caps[resolved];
  const forX = resolved === 'xSafe';

  // Hard guard for X: never put domain/url in the tweet body
  if (forX) {
    text = buildXSafePromoCaption(code || '');
    if (!isXAlgorithmSafeCaption(text)) {
      text = 'Search Google: ViralRefer — free link in 30s. Scan the QR on my image.';
    }
  }

  const msg = forX
    ? 'X-safe caption copied (no domain) — attach your QR banner image'
    : 'Caption copied — paste with your banner';
  void copyText(text, msg);
  trackViralLoopEvent('PromoKitCopyCaption', { kind: resolved, xSafe: forX });
}

export function copyPromoPersonalLink(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, 'copy_link') : null;
  if (!link) {
    showToast('Your referral code is missing — refresh and try again', 'info');
    return;
  }
  void copyText(link, 'Your promo link copied (use outside X — X flags the domain)');
  trackViralLoopEvent('PromoKitCopyLink', {});
}

export function openPromoBanner(id: string): void {
  void (async () => {
    if (!isPromoKitUnlocked()) {
      showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
      return;
    }
    const spec = PROMO_BANNERS.find((b) => b.id === id);
    if (!spec) return;

    const code = resolveCode();
    const link = code ? buildPersonalPromoLink(code, `banner_${id}`) : null;
    if (!code || !link) {
      showToast('Your referral code is missing — refresh and try again', 'info');
      return;
    }

    showToast(`Building ${spec.label} with your QR…`, 'info');
    const ok = await downloadPromoBannerWithQr(spec, link, code);
    if (ok) {
      trackViralLoopEvent('PromoKitOpenBanner', { id, withQr: true });
      // For X-sized square, auto-copy X-safe caption
      if (id === '1080x1080') {
        const xCap = buildXSafePromoCaption(code);
        void copyText(xCap, 'QR banner downloaded + X-safe caption copied');
      } else {
        showToast(`${spec.label} downloaded with your QR — post + paste caption`, 'success');
      }
    } else {
      // Fallback: open raw banner
      window.open(bannerUrl(spec.file), '_blank', 'noopener,noreferrer');
      trackViralLoopEvent('PromoKitOpenBanner', { id, withQr: false });
      showToast('Opened plain banner — QR stamp failed; paste your link in the caption', 'info');
    }
  })();
}

export function openPromoTelegramHelper(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  window.open(`${TELEGRAM_BOT}?start=promo_kit`, '_blank', 'noopener,noreferrer');
  trackViralLoopEvent('PromoKitTelegram', {});
}

export function runPromoSharePack(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const fn = (window as unknown as { downloadSharePack?: () => void }).downloadSharePack;
  if (typeof fn === 'function') {
    fn();
    trackViralLoopEvent('PromoKitSharePack', {});
  } else {
    showToast('Share pack not ready — use Story / square buttons above', 'info');
  }
}

let wired = false;

export function initPromoKit(): void {
  if (wired) {
    syncPromoKitUI();
    return;
  }
  wired = true;
  wasUnlocked = isPromoKitUnlocked();

  registerGlobal('copyPromoCaption', (kind?: string) => {
    copyPromoCaption(kind);
  });
  registerGlobal('copyPromoPersonalLink', copyPromoPersonalLink);
  registerGlobal('openPromoBanner', openPromoBanner);
  registerGlobal('openPromoTelegramHelper', openPromoTelegramHelper);
  registerGlobal('runPromoSharePack', runPromoSharePack);
  registerGlobal('syncPromoKitUI', syncPromoKitUI);

  const list = document.getElementById('promo-kit-banners');
  if (list && !list.dataset.filled) {
    list.dataset.filled = '1';
    list.innerHTML = PROMO_BANNERS.map(
      (b) => `
      <button type="button" class="promo-kit-banner-btn" data-promo-banner="${b.id}"
              title="Download ${b.size} with your personal QR">
        <span class="promo-kit-banner-size">${b.size}</span>
        <span class="promo-kit-banner-label">${b.label} · QR</span>
      </button>`,
    ).join('');
    list.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-promo-banner]') as HTMLElement | null;
      if (!t) return;
      openPromoBanner(t.getAttribute('data-promo-banner') || '');
    });
  }

  try {
    const mo = new MutationObserver(() => syncPromoKitUI());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-vr-share-locked', 'data-vr-has-link'],
    });
  } catch {
    /* ignore */
  }

  syncPromoKitUI();
}
