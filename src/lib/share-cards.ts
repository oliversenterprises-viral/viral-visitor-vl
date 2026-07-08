/**
 * Canvas share card generators — square (X) and vertical story (IG/TikTok).
 */

export type ShareCardFormat = 'square' | 'story';

export interface ShareCardSpec {
  link: string;
  code: string;
  format: ShareCardFormat;
  /** When 1, renders gold winner styling (wave 7). */
  rank?: number | null;
}

export function shareCardDimensions(format: ShareCardFormat): { width: number; height: number } {
  return format === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

export function shareCardFilename(code: string, format: ShareCardFormat): string {
  const suffix = format === 'story' ? 'story' : 'share';
  return `viralrefer-${code}-${suffix}.png`;
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

/** Render a branded share card to canvas. Returns null if canvas unsupported. */
export function renderShareCard(canvas: HTMLCanvasElement, spec: ShareCardSpec): boolean {
  const { width, height } = shareCardDimensions(spec.format);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return false;

  const isStory = spec.format === 'story';
  const isLeader = spec.rank === 1;
  const pad = isStory ? 72 : 80;

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

  if (isLeader) {
    ctx.fillStyle = '#0a0a0a';
    ctx.font = `bold ${isStory ? 32 : 28}px system-ui, sans-serif`;
    ctx.fillText('#1 ON LEADERBOARD', pad, isStory ? 120 : 78);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isStory ? 72 : 64}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('ViralRefer', pad, isStory ? 200 : 130);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${isStory ? 36 : 32}px system-ui, sans-serif`;
  ctx.fillText('LIVE REFERRAL LEADERBOARD', pad, isStory ? 260 : 175);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isStory ? 52 : 48}px system-ui, sans-serif`;
  ctx.fillText('My Referral Link', pad, isStory ? 380 : 280);

  ctx.fillStyle = '#34d399';
  ctx.font = `bold ${isStory ? 40 : 36}px ui-monospace, monospace`;
  const linkBottomY = drawWrappedText(ctx, spec.link, pad, isStory ? 460 : 360, width - pad * 2, isStory ? 52 : 48);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = `${isStory ? 40 : 36}px system-ui, sans-serif`;
  ctx.fillText('Join the real-time leaderboard.', pad, linkBottomY + (isStory ? 100 : 80));

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${isStory ? 32 : 28}px system-ui, sans-serif`;
  const hint = isStory
    ? 'Free to join — add as Story or post. Link is in the image.'
    : 'Free to join — scan or type the link in the image.';
  drawWrappedText(ctx, hint, pad, linkBottomY + (isStory ? 155 : 125), width - pad * 2, isStory ? 40 : 32);

  const footerY = isStory ? height - 160 : 960;
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, footerY, width, isStory ? 160 : 120);

  ctx.fillStyle = '#7c3aed';
  ctx.font = `bold ${isStory ? 36 : 32}px system-ui, sans-serif`;
  ctx.fillText('viralrefer.app', pad, footerY + (isStory ? 70 : 55));

  ctx.fillStyle = '#71717a';
  ctx.font = `${isStory ? 28 : 24}px system-ui, sans-serif`;
  const footerHint = isStory ? 'Perfect for Instagram, TikTok & Stories' : 'Attach this image to your post on X';
  ctx.fillText(footerHint, pad, footerY + (isStory ? 115 : 90));

  return true;
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