import { describe, expect, it } from 'vitest';
import { ENTERED_TTL_MS, promoteEnteredDrop } from '../../src/lib/site-drops';
import { paintSiteDrops } from '../../src/lib/site-drops-ui';

describe('site-drops-ui paint', () => {
  it('hides the ticker when only expired August pending exists', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty">No one just entered.</p>
    `;
    paintSiteDrops(
      {
        drops: [],
        pending_entered: [{ code: 'VIRAL-V7VH0BW', earned_at: '2026-08-29T01:14:25.203Z' }],
      },
      new Date('2026-09-02T10:40:00Z'),
    );
    const ticker = document.getElementById('site-entered-ticker');
    expect(ticker?.hidden).toBe(true);
    expect(document.getElementById('site-entered-chips')?.innerHTML).toBe('');
    expect(document.getElementById('site-drops-entered-empty')?.hidden).toBe(false);
  });

  it('paints a new Just entered chip after promotion', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty">No one just entered.</p>
    `;
    const now = new Date('2026-09-02T12:00:00Z');
    const state = promoteEnteredDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-PAINT01', url: 'https://paint.example', label: 'Paint' },
      now,
    );
    paintSiteDrops(state, now);
    expect(document.getElementById('site-entered-ticker')?.hidden).toBe(false);
    expect(document.getElementById('site-entered-chips')?.textContent).toContain('Paint');
    expect(document.getElementById('site-drops-entered-list')?.textContent).toContain('Just entered');
    expect(Date.parse(state.drops[0].expires_at) - now.getTime()).toBe(ENTERED_TTL_MS);
  });
});
