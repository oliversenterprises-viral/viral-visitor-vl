/**
 * Daily Crown share card — canvas PNG for bragging rights (no cash).
 */

export interface DailyCrownCardSpec {
  code: string;
  refs: number;
  kind: 'champion' | 'leader';
  dayLabel: string;
}

export function dailyCrownFilename(code: string, kind: string): string {
  return `viralrefer-daily-crown-${kind}-${code}.png`.toLowerCase();
}

/** Compact HTML CTA block when user holds crown / lead. */
export function buildDailyCrownShareCardHtml(spec: DailyCrownCardSpec): string {
  const title =
    spec.kind === 'champion'
      ? 'You hold the Daily Crown'
      : "You're leading today's crown race";
  return `
    <div class="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-semibold text-amber-100">${title}</div>
        <div class="text-xs text-zinc-400">${spec.refs} referral${spec.refs === 1 ? '' : 's'} · ${spec.dayLabel} · share your flex</div>
      </div>
      <button type="button" data-daily-crown-share="mine"
        class="text-xs font-bold px-4 py-2 rounded-xl bg-amber-400 text-zinc-900 hover:bg-amber-300 transition-colors">
        Download crown card
      </button>
    </div>`;
}

/** Render + download PNG share card. */
export async function downloadDailyCrownCard(spec: DailyCrownCardSpec): Promise<boolean> {
  const canvas = document.createElement('canvas');
  const ok = await renderDailyCrownCard(canvas, spec);
  if (!ok) return false;

  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dailyCrownFilename(spec.code, spec.kind);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function renderDailyCrownCard(
  canvas: HTMLCanvasElement,
  spec: DailyCrownCardSpec,
): Promise<boolean> {
  const width = 1080;
  const height = 1080;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return false;

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0c0a09');
  bg.addColorStop(0.5, '#1c1917');
  bg.addColorStop(1, '#292524');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Gold frame
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Header bar
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#b45309');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#fbbf24');
  ctx.fillStyle = grad;
  ctx.fillRect(60, 60, width - 120, 120);

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('ViralRefer', 90, 135);
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(
    spec.kind === 'champion' ? 'DAILY CROWN CHAMPION' : 'DAILY CROWN LEADER',
    90,
    168,
  );

  // Crown emoji as text
  ctx.font = '120px system-ui, sans-serif';
  ctx.fillText('👑', width / 2 - 60, 360);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 64px ui-monospace, monospace';
  const code = (spec.code || '').toUpperCase();
  const codeWidth = ctx.measureText(code).width;
  ctx.fillText(code, (width - codeWidth) / 2, 460);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 96px system-ui, sans-serif';
  const refs = `${spec.refs}`;
  const refsW = ctx.measureText(refs).width;
  ctx.fillText(refs, (width - refsW) / 2, 600);

  ctx.fillStyle = '#a8a29e';
  ctx.font = '32px system-ui, sans-serif';
  const sub =
    spec.kind === 'champion'
      ? `referrals · crowned ${spec.dayLabel || ''}`.trim()
      : `referrals today · ${spec.dayLabel || 'UTC day'}`.trim();
  const subW = ctx.measureText(sub).width;
  ctx.fillText(sub, (width - subW) / 2, 660);

  ctx.fillStyle = '#e7e5e4';
  ctx.font = '28px system-ui, sans-serif';
  const tagline =
    spec.kind === 'champion'
      ? '24h Daily Crown · recognition only · no cash'
      : 'Leading the 24h crown race · knock them off';
  const tagW = ctx.measureText(tagline).width;
  ctx.fillText(tagline, (width - tagW) / 2, 760);

  ctx.fillStyle = '#78716c';
  ctx.font = '24px system-ui, sans-serif';
  const url = 'viralrefer.app';
  const urlW = ctx.measureText(url).width;
  ctx.fillText(url, (width - urlW) / 2, 920);

  ctx.fillStyle = '#57534e';
  ctx.font = '20px system-ui, sans-serif';
  const disc = 'Separate from overall #1 homepage feature · skill-based · free';
  const discW = ctx.measureText(disc).width;
  ctx.fillText(disc, (width - discW) / 2, 970);

  return true;
}
