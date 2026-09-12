import type { UnlockMoment } from './types';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number };

const COLORS = ['#d6ff3e', '#ff3d8a', '#3ee8ff', '#ffc857', '#f4f1ea'];
const particles: Particle[] = [];

function ensureCanvas(): CanvasRenderingContext2D | null {
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
    p.vy += 0.12;
    p.life -= 1;
    c.globalAlpha = Math.max(0, p.life / 70);
    c.fillStyle = p.color;
    c.beginPath();
    c.arc(p.x * scale, p.y * scale, p.r * scale, 0, Math.PI * 2);
    c.fill();
    if (p.life <= 0) particles.splice(i, 1);
  }
  c.globalAlpha = 1;
  if (particles.length) raf = requestAnimationFrame(tick);
  else raf = 0;
}

export function burst(x = innerWidth / 2, y = innerHeight * 0.35): void {
  ensureCanvas();
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 3 + Math.random() * 9;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 2,
      life: 45 + Math.random() * 30,
      color: COLORS[i % COLORS.length],
      r: 1.5 + Math.random() * 3,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

export function celebrateUnlock(unlock: UnlockMoment): void {
  burst();
  const existing = document.querySelector('.celebrate');
  existing?.remove();
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `
    <div class="celebrate-card">
      <p class="kicker">UNLOCK</p>
      <h2>${escapeMini(unlock.title)}</h2>
      <p>${escapeMini(unlock.host)} just climbed. Share this rung while it is hot.</p>
      <button type="button" class="btn volt" data-close-celebrate>Share this moment</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('[data-close-celebrate]')?.addEventListener('click', () => el.remove());
  el.addEventListener('click', (e) => {
    if (e.target === el) el.remove();
  });
  setTimeout(() => el.classList.add('on'), 10);
}

function escapeMini(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
