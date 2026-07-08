import { describe, it, expect } from 'vitest';
import {
  buildPixelHeatmapCss,
  computePixelHeatmap,
} from '../../src/lib/optimizer-heatmap';

describe('optimizer-heatmap', () => {
  it('buckets click coordinates into grid cells', () => {
    const result = computePixelHeatmap([
      { event_type: 'click', x: 100, y: 200, viewport_w: 390, viewport_h: 844 },
      { event_type: 'click', x: 105, y: 205, viewport_w: 390, viewport_h: 844 },
      { event_type: 'scroll_depth', x: 100, y: 200 },
    ]);
    expect(result.totalClicks).toBe(2);
    expect(result.cells.length).toBeGreaterThan(0);
    expect(result.maxCount).toBeGreaterThanOrEqual(1);
  });

  it('builds CSS gradient layers when clicks exist', () => {
    const heat = computePixelHeatmap([
      { event_type: 'click', x: 50, y: 100, viewport_w: 390, viewport_h: 844 },
    ]);
    const css = buildPixelHeatmapCss(heat);
    expect(css).toContain('radial-gradient');
  });
});