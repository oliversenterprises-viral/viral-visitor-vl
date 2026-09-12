import {
  burstTier,
  celebrationKicker,
  celebrationLine,
  playHit,
  prefersReducedMotion,
  type BurstTier,
} from './game';
import { t } from './lib/i18n';
import type { UnlockMoment } from './types';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
  kind: 'dot' | 'chip';
  rot: number;
  vr: number;
};

/** Site Drops palette — violet / emerald / amber / white. No neon Ultra. */
const COLORS = ['#7c3aed', '#c4b5fd', '#34d399', '#fbbf24', '#f4f4f5', '#059669'];
const particles: Particle[] = [];

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (prefersReducedMotion()) return null;
  if (canvas && ctx) return ctx;
  canvas = document.createElement('canvas');
  canvas.className = 'burst-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    if (!canvas) return;
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };
  resize();
  addEventListener('resize', resize);
  return ctx;
}

function tick(): void {
  const c = ctx;
  if (!c || !canvas) return;
  c.clearRect(0, 0, canvas.width, canvas.height);
  const scale = devicePixelRatio;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.13;
    p.rot += p.vr;
    p.life -= 1;
    c.globalAlpha = Math.max(0, p.life / 80);
    c.fillStyle = p.color;
    if (p.kind === 'chip') {
      c.save();
      c.translate(p.x * scale, p.y * scale);
      c.rotate(p.rot);
      c.fillRect((-p.r * 2) * scale, (-p.r * 0.6) * scale, p.r * 4 * scale, p.r * 1.2 * scale);
      c.restore();
    } else {
      c.beginPath();
      c.arc(p.x * scale, p.y * scale, p.r * scale, 0, Math.PI * 2);
      c.fill();
    }
    if (p.life <= 0) particles.splice(i, 1);
  }
  c.globalAlpha = 1;
  if (particles.length) raf = requestAnimationFrame(tick);
  else raf = 0;
}

const TIER_N: Record<BurstTier, number> = { spark: 56, burst: 110, storm: 180 };

export function burst(x = innerWidth / 2, y = innerHeight * 0.35, tier: BurstTier = 'burst'): void {
  if (!ensureCanvas()) return;
  const n = TIER_N[tier];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 3 + Math.random() * (tier === 'storm' ? 15 : 10);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 2.4,
      life: 50 + Math.random() * 36,
      color: COLORS[i % COLORS.length],
      r: 1.4 + Math.random() * 3.2,
      kind: i % 3 === 0 ? 'chip' : 'dot',
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

export function pulseKit(): void {
  const kit = document.getElementById('post-link-share');
  if (!kit) return;
  kit.classList.add('is-drop');
  window.setTimeout(() => kit.classList.remove('is-drop'), prefersReducedMotion() ? 80 : 1600);
}

export function pulseBanner(): void {
  const slot = document.getElementById('hero-banner-mock');
  if (!slot) return;
  slot.classList.add('is-pulse');
  window.setTimeout(() => slot.classList.remove('is-pulse'), prefersReducedMotion() ? 80 : 1400);
}

export function celebrateUnlock(unlock: UnlockMoment, onShare?: () => void): void {
  celebrateHit({ host: unlock.host, credits: 3, unlock, onShare });
}

export function celebrateHit(opts: {
  host: string;
  credits: number;
  unlock?: UnlockMoment | null;
  onShare?: () => void;
}): void {
  const tier = burstTier(opts.credits, Boolean(opts.unlock));
  burst(innerWidth / 2, innerHeight * 0.38, tier);
  playHit();
  pulseKit();
  pulseBanner();
  if (!opts.unlock) return;
  const existing = document.querySelector('.celebrate');
  existing?.remove();
  const title = opts.unlock.title;
  const kicker = celebrationKicker({ credits: opts.credits, unlock: title });
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <div class="celebrate-card">
      <p class="kicker">${escapeMini(kicker)}</p>
      <h2>${escapeMini(title)}</h2>
      <p>${escapeMini(celebrationLine(opts.credits, opts.host, opts.unlock.title))}</p>
      <p class="brag">${escapeMini(opts.unlock.shareText)}</p>
      <button type="button" class="btn volt" data-close-celebrate>${escapeMini(t('celeb.share'))}</button>
      <button type="button" class="btn ghost" data-dismiss-celebrate>${escapeMini(t('celeb.close'))}</button>
    </div>`;
  document.body.appendChild(el);
  const share = () => {
    el.remove();
    opts.onShare?.();
  };
  const dismiss = () => el.remove();
  el.querySelector('[data-close-celebrate]')?.addEventListener('click', share);
  el.querySelector('[data-dismiss-celebrate]')?.addEventListener('click', dismiss);
  el.addEventListener('click', (e) => {
    if (e.target === el) dismiss();
  });
  setTimeout(() => el.classList.add('on'), prefersReducedMotion() ? 0 : 10);
}

function escapeMini(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
