import { describe, expect, it } from 'vitest';
import { paintSiteDrops } from '../../src/lib/site-drops-ui';

describe('site-drops-ui', () => {
  it('paints a Just entered chip and hides empty copy', () => {
    document.body.innerHTML = `
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty"></p>
      <ul id="site-drops-rising-list"></ul>
      <p id="site-drops-rising-empty"></p>
      <div id="site-entered-ticker" class="hidden" hidden></div>
      <div id="site-entered-chips"></div>
    `;
    const now = new Date('2026-09-02T12:00:00Z');
    paintSiteDrops(
      {
        drops: [
          {
            kind: 'entered',
            code: 'VIRAL-CHIP01',
            url: 'https://racer.example',
            label: 'Racer',
            locks: 0,
            rank: null,
            week: '2026-08-31',
            expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
            updated_at: now.toISOString(),
          },
        ],
        pending_entered: [{ code: 'VIRAL-OLD01', earned_at: '2026-08-29T00:00:00Z' }],
      },
      now,
    );
    expect(document.getElementById('site-drops-entered-list')?.innerHTML).toContain('Racer');
    expect(document.getElementById('site-drops-entered-list')?.innerHTML).toContain('Just entered');
    expect(document.getElementById('site-drops-entered-empty')?.hidden).toBe(true);
    expect(document.getElementById('site-entered-ticker')?.hidden).toBe(false);
    expect(document.getElementById('site-drops-entered-list')?.innerHTML).not.toContain('VIRAL-OLD01');
  });
});
