import { describe, expect, it } from 'vitest';
import { ENTERED_TTL_MS, promoteEnteredDrop } from '../../src/lib/site-drops';
import { applySiteDropsFromContent, paintSiteDrops } from '../../src/lib/site-drops-ui';
import {
  LOCKED_DROP_CHALLENGER_EMPTY,
  LOCKED_DROP_ENTERED_EMPTY,
  LOCKED_DROP_RISING_EMPTY,
} from '../../src/lib/site-drops-copy';

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

  it('shows existing empty-state copy when the ladder payload is empty (timeout)', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty">${LOCKED_DROP_ENTERED_EMPTY}</p>
      <ul id="site-drops-rising-list"></ul>
      <p id="site-drops-rising-empty">${LOCKED_DROP_RISING_EMPTY}</p>
      <ul id="site-drops-challenger-list"></ul>
      <p id="site-drops-challenger-empty">${LOCKED_DROP_CHALLENGER_EMPTY}</p>
    `;
    paintSiteDrops({ drops: [], pending_entered: [] });
    expect(document.getElementById('site-drops-entered-empty')?.hidden).toBe(false);
    expect(document.getElementById('site-drops-entered-empty')?.textContent).toContain(
      'No one just entered',
    );
    expect(document.getElementById('site-drops-rising-empty')?.hidden).toBe(false);
    expect(document.getElementById('site-drops-rising-empty')?.textContent).toContain(
      'Rising slots are open',
    );
    expect(document.getElementById('site-drops-challenger-empty')?.hidden).toBe(false);
    expect(document.getElementById('site-drops-challenger-empty')?.textContent).toContain(
      'No challengers yet',
    );
    expect(document.getElementById('site-entered-ticker')?.hidden).toBe(true);
    expect(document.getElementById('site-drops-entered-list')?.innerHTML).toBe('');
  });

  it('does not wipe an independently fetched ladder when CMS has no site_drops key', () => {
    document.body.innerHTML = `
      <ul id="site-drops-entered-list"><li>keep-me</li></ul>
      <p id="site-drops-entered-empty" hidden>No one just entered.</p>
    `;
    applySiteDropsFromContent({ hero_title: 'ignored' });
    expect(document.getElementById('site-drops-entered-list')?.innerHTML).toBe('<li>keep-me</li>');
  });
});
