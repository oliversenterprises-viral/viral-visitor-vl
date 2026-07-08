/**
 * Pixel heatmap aggregation — normalize clicks to a reference mobile viewport.
 */

import type { InteractionRow } from './viral-optimizer-helpers';

export interface PixelHeatCell {
  gx: number;
  gy: number;
  count: number;
}

export interface PixelHeatmapResult {
  cells: PixelHeatCell[];
  maxCount: number;
  totalClicks: number;
  refWidth: number;
  refHeight: number;
  gridCols: number;
  gridRows: number;
}

export const DEFAULT_HEATMAP_REF_WIDTH = 390;
export const DEFAULT_HEATMAP_REF_HEIGHT = 844;
export const DEFAULT_HEATMAP_GRID = 26;

export function computePixelHeatmap(
  interactions: readonly InteractionRow[],
  refWidth = DEFAULT_HEATMAP_REF_WIDTH,
  refHeight = DEFAULT_HEATMAP_REF_HEIGHT,
  gridCols = DEFAULT_HEATMAP_GRID,
): PixelHeatmapResult {
  const gridRows = Math.max(8, Math.round((gridCols * refHeight) / refWidth));
  const bucket = new Map<string, number>();
  let totalClicks = 0;

  for (const row of interactions) {
    if (row.event_type !== 'click') continue;
    const x = Number(row.x);
    const y = Number(row.y);
    const vw = Number(row.viewport_w) || refWidth;
    const vh = Number(row.viewport_h) || refHeight;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const nx = Math.min(refWidth - 1, Math.max(0, (x / vw) * refWidth));
    const ny = Math.min(refHeight - 1, Math.max(0, (y / vh) * refHeight));
    const gx = Math.min(gridCols - 1, Math.floor((nx / refWidth) * gridCols));
    const gy = Math.min(gridRows - 1, Math.floor((ny / refHeight) * gridRows));
    const key = `${gx},${gy}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
    totalClicks += 1;
  }

  const cells: PixelHeatCell[] = [];
  let maxCount = 0;
  for (const [key, count] of bucket.entries()) {
    const [gx, gy] = key.split(',').map(Number);
    cells.push({ gx, gy, count });
    if (count > maxCount) maxCount = count;
  }

  return {
    cells,
    maxCount: maxCount || 1,
    totalClicks,
    refWidth,
    refHeight,
    gridCols,
    gridRows,
  };
}

/** Build CSS radial-gradient layers for admin heatmap preview (no canvas). */
export function buildPixelHeatmapCss(
  result: PixelHeatmapResult,
  displayWidth = 390,
  displayHeight = 220,
): string {
  if (!result.cells.length) return '';
  const scaleX = displayWidth / result.gridCols;
  const scaleY = displayHeight / result.gridRows;
  const layers = result.cells
    .map((c) => {
      const intensity = c.count / result.maxCount;
      const alpha = 0.15 + intensity * 0.75;
      const cx = (c.gx + 0.5) * scaleX;
      const cy = (c.gy + 0.5) * scaleY;
      const radius = Math.max(12, scaleX * 1.4);
      return `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, rgba(239,68,68,${alpha.toFixed(2)}) 0%, transparent 70%)`;
    })
    .join(', ');
  return layers;
}