/**
 * Rank receipt cards — shareable proof image (rank, referrals, QR).
 */

import { buildQrImageUrl } from './share-power';
import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';

export interface RankReceiptSpec {
  code: string;
  link: string;
  rank: number | null;
  referrals: number;
}

const RECEIPT_LAST_KEY = 'vr_receipt_last_signature';

export function rankReceiptFilename(code: string): string {
  return `viralrefer-receipt-${code}.png`;
}

export function rankReceiptSignature(spec: RankReceiptSpec): string {
  return `${spec.code}:${spec.referrals}:${spec.rank ?? 0}`;
}

function drawReceiptHeader(ctx: CanvasRenderingContext2D, width: number): void {
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#7c3aed');
  grad.addColorStop(1, '#c026d3');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText('ViralRefer', 48, 62);
  ctx.fillStyle = '#e4e4e7';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('RANK RECEIPT', 48, 88);
}

/** Render rank receipt to canvas (async for QR image load). */
export async function renderRankReceiptCard(
  canvas: HTMLCanvasElement,
  spec: RankReceiptSpec,
): Promise<boolean> {
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return false;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
  drawReceiptHeader(ctx, width);

  const isLeader = spec.rank === 1;
  ctx.fillStyle = isLeader ? '#fbbf24' : '#34d399';
  ctx.font = 'bold 96px system-ui, sans-serif';
  const rankLabel = spec.rank ? `#${spec.rank}` : '—';
  ctx.fillText(rankLabel, 48, 240);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('LEADERBOARD RANK', 48, 280);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(`${spec.referrals}`, 48, 380);
  ctx.fillStyle = '#71717a';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(`REFERRAL${spec.referrals === 1 ? '' : 'S'}`, 48, 420);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '24px ui-monospace, monospace';
  ctx.fillText(spec.code, 48, 500);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '22px system-ui, sans-serif';
  const sub = isLeader
    ? 'Defend your #1 spot — share this receipt.'
    : 'Share this proof — climb the live board.';
  ctx.fillText(sub, 48, 560);

  try {
    const qrUrl = buildQrImageUrl(spec.link, 360);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('qr load failed'));
      el.src = qrUrl;
    });
    const qrX = 48;
    const qrY = 620;
    const qrSize = 320;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(48, 620, 320, 320);
    ctx.fillStyle = '#71717a';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('QR unavailable', 120, 780);
  }

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, height - 120, width, 120);
  ctx.fillStyle = '#7c3aed';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('viralrefer.app', 48, height - 55);
  ctx.fillStyle = '#71717a';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Scan to join the contest', 48, height - 22);

  return true;
}

export function downloadRankReceipt(canvas: HTMLCanvasElement, code: string): void {
  const a = document.createElement('a');
  a.download = rankReceiptFilename(code);
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  trackViralLoopEvent('ReceiptShared', { action: 'download' });
}

function shouldOfferReceipt(spec: RankReceiptSpec): boolean {
  if (!getViralLoopsConfig().receipt_enabled) return false;
  try {
    const sig = rankReceiptSignature(spec);
    const prev = localStorage.getItem(RECEIPT_LAST_KEY);
    if (prev === sig) return false;
    localStorage.setItem(RECEIPT_LAST_KEY, sig);
    return true;
  } catch {
    return true;
  }
}

let receiptWired = false;
let latestReceiptSpec: RankReceiptSpec | null = null;

function wireReceiptActions(): void {
  if (receiptWired) return;
  receiptWired = true;

  document.getElementById('rank-receipt-download')?.addEventListener('click', async () => {
    const spec = latestReceiptSpec;
    const canvas = document.getElementById('rank-receipt-canvas') as HTMLCanvasElement | null;
    if (!spec || !canvas) return;
    const ok = await renderRankReceiptCard(canvas, spec);
    if (ok) downloadRankReceipt(canvas, spec.code);
  });

  document.getElementById('rank-receipt-share')?.addEventListener('click', async () => {
    const spec = latestReceiptSpec;
    const canvas = document.getElementById('rank-receipt-canvas') as HTMLCanvasElement | null;
    if (!spec || !canvas || !navigator.share) return;
    const ok = await renderRankReceiptCard(canvas, spec);
    if (!ok) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) return;
      const file = new File([blob], rankReceiptFilename(spec.code), { type: 'image/png' });
      await navigator.share({
        title: 'My ViralRefer rank receipt',
        text: `I'm #${spec.rank ?? '—'} on ViralRefer with ${spec.referrals} referrals`,
        files: [file],
      });
      trackViralLoopEvent('ReceiptShared', { action: 'native_share' });
    } catch {
      // user cancelled or unsupported
    }
  });
}

/** Show rank receipt CTA after link ready or rank change. */
export async function offerRankReceipt(spec: RankReceiptSpec): Promise<void> {
  if (!getViralLoopsConfig().receipt_enabled) return;
  const root = document.getElementById('rank-receipt-cta');
  if (!root) return;

  const headline = root.querySelector('[data-receipt-headline]');
  const subline = root.querySelector('[data-receipt-subline]');
  const rankEl = root.querySelector('[data-receipt-rank]');
  const refsEl = root.querySelector('[data-receipt-refs]');

  const rankText = spec.rank ? `#${spec.rank}` : 'Unranked';
  if (headline) {
    headline.textContent = spec.rank === 1
      ? 'You’re #1 — flex your receipt'
      : 'Your rank receipt is ready';
  }
  if (subline) {
    subline.textContent = 'Download or share proof with your QR link — perfect for Stories.';
  }
  if (rankEl) rankEl.textContent = rankText;
  if (refsEl) refsEl.textContent = String(spec.referrals);

  const canvas = document.getElementById('rank-receipt-canvas') as HTMLCanvasElement | null;
  if (canvas) {
    void renderRankReceiptCard(canvas, spec);
  }

  const shareBtn = document.getElementById('rank-receipt-share');
  if (shareBtn) {
    shareBtn.classList.toggle('hidden', typeof navigator.share !== 'function');
  }

  latestReceiptSpec = spec;
  root.classList.remove('hidden');
  wireReceiptActions();

  if (shouldOfferReceipt(spec)) {
    trackViralLoopEvent('ReceiptGenerated', {
      rank: spec.rank,
      referrals: spec.referrals,
    });
  }
}

/** Light nudge after a share — points visitors to rank receipt asset. */
export function nudgeReceiptAfterShare(): void {
  if (!getViralLoopsConfig().receipt_enabled || !latestReceiptSpec) return;
  void import('../ui').then(({ showToast }) => {
    showToast('Flex your rank — download your receipt card below', 'info');
  });
}