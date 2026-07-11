/**
 * Canvas share card generators — square (X) and vertical story (IG/TikTok).
 * Status flex: rank, gap-to-next, referral count when available.
 */

export type ShareCardFormat = 'square' | 'story';

export interface ShareCardSpec {
  link: string;
  code: string;
  format: ShareCardFormat;
  /** When 1, renders gold winner styling. */
  rank?: number | null;
  /** Referrals needed to overtake the person above. */
  gapToNext?: number | null;
  /** Personal verified referral count. */
  referralCount?: number;
}

export function shareCardDimensions(format: ShareCardFormat): { width: number; height: number } {
  return format === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

export function shareCardFilename(code: string, format: ShareCardFormat): string {
  const suffix = format === 'story' ? 'story' : 'share';
  return `viralrefer-${code}-${suffix}.png`;
}

/** Pure status line for tests + canvas (no DOM). */
export function buildShareCardStatusLine(spec: Pick<ShareCardSpec, 'rank' | 'gapToNext' | 'referralCount'>): string {
  const rank = spec.rank;
  const gap = spec.gapToNext;
  const refs = spec.referralCount ?? 0;

  if (rank === 1) return '#1 ON THE LEADERBOARD';
  if (rank != null && rank > 1 && gap != null && gap >= 1) {
    if (gap === 1) return `RANK #${rank} · 1 MORE TO CLIMB`;
    return `RANK #${rank} · ${gap} MORE TO NEXT`;
  }
  if (rank != null && rank > 1) return `RANK #${rank} ON THE BOARD`;
  if (refs > 0) return `${refs} REFERRAL${refs === 1 ? '' : 'S'} · RANK PENDING`;
  return 'UNRANKED · FIRST REFERRAL UNLOCKS RANK';
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let line = '';
  let y = startY;
  for (const ch of text) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

/** Render a branded status share card to canvas. Returns false if canvas unsupported. */
export function renderShareCard(canvas: HTMLCanvasElement, spec: ShareCardSpec): boolean {
  const { width, height } = shareCardDimensions(spec.format);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return false;

  const isStory = spec.format === 'story';
  const isLeader = spec.rank === 1;
  const pad = isStory ? 72 : 80;
  const statusLine = buildShareCardStatusLine(spec);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, width, 0);
  if (isLeader) {
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#fbbf24');
  } else {
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(1, '#c026d3');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, isStory ? 140 : 90);

  ctx.fillStyle = isLeader ? '#0a0a0a' : '#f5f3ff';
  ctx.font = `bold ${isStory ? 30 : 26}px system-ui, sans-serif`;
  ctx.fillText(statusLine, pad, isStory ? 118 : 74);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isStory ? 72 : 64}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('ViralRefer', pad, isStory ? 230 : 160);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${isStory ? 34 : 30}px system-ui, sans-serif`;
  ctx.fillText('LIVE REFERRAL LEADERBOARD', pad, isStory ? 290 : 205);

  // Status flex box
  const boxY = isStory ? 340 : 250;
  const boxH = isStory ? 160 : 130;
  ctx.fillStyle = isLeader ? 'rgba(245, 158, 11, 0.12)' : 'rgba(124, 58, 237, 0.15)';
  ctx.strokeStyle = isLeader ? 'rgba(251, 191, 36, 0.55)' : 'rgba(167, 139, 250, 0.4)';
  ctx.lineWidth = 3;
  roundRect(ctx, pad, boxY, width - pad * 2, boxH, 24);
  ctx.fill();
  ctx.stroke();

  const rankLabel =
    spec.rank != null && spec.rank >= 1 ? `#${spec.rank}` : '—';
  const gapLabel =
    spec.rank === 1
      ? 'DEFEND'
      : spec.gapToNext != null && spec.gapToNext >= 1
        ? String(spec.gapToNext)
        : '—';
  const refsLabel = String(Math.max(0, spec.referralCount ?? 0));

  const colW = (width - pad * 2) / 3;
  const colY = boxY + (isStory ? 55 : 45);
  const colSubY = boxY + (isStory ? 115 : 95);

  drawStatCol(ctx, pad + colW * 0.5, colY, colSubY, rankLabel, 'RANK', isStory);
  drawStatCol(ctx, pad + colW * 1.5, colY, colSubY, gapLabel, 'GAP TO NEXT', isStory);
  drawStatCol(ctx, pad + colW * 2.5, colY, colSubY, refsLabel, 'REFERRALS', isStory);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isStory ? 48 : 44}px system-ui, sans-serif`;
  ctx.fillText('My Referral Link', pad, boxY + boxH + (isStory ? 80 : 70));

  ctx.fillStyle = '#34d399';
  ctx.font = `bold ${isStory ? 40 : 36}px ui-monospace, monospace`;
  const linkBottomY = drawWrappedText(
    ctx,
    spec.link,
    pad,
    boxY + boxH + (isStory ? 150 : 130),
    width - pad * 2,
    isStory ? 52 : 48,
  );

  ctx.fillStyle = '#e4e4e7';
  ctx.font = `${isStory ? 38 : 34}px system-ui, sans-serif`;
  ctx.fillText('Challenge a friend — can they beat you?', pad, linkBottomY + (isStory ? 90 : 72));

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${isStory ? 30 : 26}px system-ui, sans-serif`;
  const hint = isStory
    ? 'Free · no signup · #1 can claim a homepage feature. Link is in the image.'
    : 'Free · no signup · #1 can claim a homepage feature. Link is in the image.';
  drawWrappedText(ctx, hint, pad, linkBottomY + (isStory ? 145 : 120), width - pad * 2, isStory ? 38 : 32);

  const footerY = isStory ? height - 160 : 960;
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, footerY, width, isStory ? 160 : 120);

  ctx.fillStyle = isLeader ? '#fbbf24' : '#7c3aed';
  ctx.font = `bold ${isStory ? 36 : 32}px system-ui, sans-serif`;
  ctx.fillText('viralrefer.app', pad, footerY + (isStory ? 70 : 55));

  ctx.fillStyle = '#71717a';
  ctx.font = `${isStory ? 28 : 24}px system-ui, sans-serif`;
  const footerHint = isStory
    ? 'Perfect for Instagram, TikTok & Stories'
    : 'Attach this image to your post on X';
  ctx.fillText(footerHint, pad, footerY + (isStory ? 115 : 90));

  return true;
}

function drawStatCol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  valueY: number,
  labelY: number,
  value: string,
  label: string,
  isStory: boolean,
): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isStory ? 44 : 40}px system-ui, sans-serif`;
  ctx.fillText(value, cx, valueY);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `bold ${isStory ? 20 : 18}px system-ui, sans-serif`;
  ctx.fillText(label, cx, labelY);
  ctx.textAlign = 'left';
}

function roundRect(
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

/** Trigger browser download of a canvas PNG. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
