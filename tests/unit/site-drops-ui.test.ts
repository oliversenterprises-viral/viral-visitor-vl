import { describe, expect, it } from 'vitest';
import { ENTERED_TTL_MS, promoteEnteredDrop } from '../../src/lib/site-drops';
import { initSiteDropForm, paintOwnSiteDropChip, paintSiteDrops } from '../../src/lib/site-drops-ui';

describe('site-drops-ui paint', () => {
  it('hides the ticker when only expired August pending exists', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty">No one just entered.</p>
      <span class="site-drop-rung" data-rung="entered">
        <span id="site-drop-rung-entered">open</span>
      </span>
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
    expect(document.getElementById('site-drop-rung-entered')?.textContent).toBe('open');
  });

  it('paints a new Just entered chip after promotion', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
      <ul id="site-drops-entered-list"></ul>
      <p id="site-drops-entered-empty">No one just entered.</p>
      <span class="site-drop-rung" data-rung="entered">
        <span id="site-drop-rung-entered">15 min</span>
      </span>
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
    expect(document.getElementById('site-drop-rung-entered')?.textContent).toBe('Paint');
    expect(document.querySelector('.site-drop-rung')?.getAttribute('data-live')).toBe('1');
    expect(Date.parse(state.drops[0].expires_at) - now.getTime()).toBe(ENTERED_TTL_MS);
  });

  it('See live Site Drops expands below-fold and jumps to the board', () => {
    document.body.innerHTML = `
      <button id="funnel-expand-btn">See how it works</button>
      <button type="button" id="post-link-site-drop-jump">See live Site Drops</button>
      <section id="site-drops"></section>
    `;
    const board = document.getElementById('site-drops') as HTMLElement;
    board.scrollIntoView = () => {};
    initSiteDropForm();
    document.getElementById('post-link-site-drop-jump')?.click();
    expect(document.documentElement.getAttribute('data-vr-funnel-expanded')).toBe('1');
    expect(document.getElementById('funnel-expand-btn')?.classList.contains('hidden')).toBe(true);
  });

  it('shows a paste destination on the send screen when no chip is live', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="site-entered-chips"></div>
      </div>
    `;
    document.documentElement.setAttribute('data-vr-has-link', '1');
    paintSiteDrops({ drops: [], pending_entered: [] }, new Date('2026-09-03T12:00:00Z'));
    expect(document.getElementById('site-entered-ticker')?.hidden).toBe(false);
    expect(document.getElementById('site-entered-chips')?.textContent).toMatch(/Paste your site/);
    document.documentElement.removeAttribute('data-vr-has-link');
  });

  it('paints your Just entered chip even without a server state payload', () => {
    document.body.innerHTML = `
      <div id="site-entered-ticker" class="hidden" hidden>
        <div id="send-ladder-proof">
          <span class="site-drop-rung" data-rung="entered">
            <span data-send-rung="entered">open</span>
          </span>
        </div>
        <div id="site-entered-chips"></div>
      </div>
    `;
    paintOwnSiteDropChip('https://own.example', 'Own', 'entered');
    expect(document.getElementById('site-entered-ticker')?.hidden).toBe(false);
    expect(document.getElementById('site-entered-chips')?.textContent).toContain('Own');
    expect(document.getElementById('site-entered-chips')?.textContent).toContain('Just entered');
    expect(document.querySelector('[data-send-rung="entered"]')?.textContent).toBe('Own');
    expect(document.querySelector('[data-rung="entered"]')?.getAttribute('data-live')).toBe('1');
  });

  it('reveals the paste slot after Get my link and submits on Enter', () => {
    document.body.innerHTML = `
      <div id="post-link-site-drop" class="hidden" hidden>
        <input id="post-link-site-drop-url" />
        <button type="button" id="post-link-site-drop-submit">Put my site on the homepage (15 min)</button>
      </div>
      <form id="site-drop-form" class="hidden" hidden>
        <input id="site-drop-url" />
      </form>
    `;
    document.documentElement.setAttribute('data-vr-has-link', '1');
    initSiteDropForm();
    expect(document.getElementById('post-link-site-drop')?.hidden).toBe(false);
    expect(document.getElementById('site-drop-form')?.hidden).toBe(false);
    const input = document.getElementById('post-link-site-drop-url') as HTMLInputElement;
    input.value = 'example.com';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((document.getElementById('site-drop-url') as HTMLInputElement).value).toBe('example.com');
    document.documentElement.removeAttribute('data-vr-has-link');
  });

  it('pasting a website saves without a second tap', () => {
    document.body.innerHTML = `
      <p id="site-drop-status"></p>
      <div id="post-link-site-drop">
        <input id="post-link-site-drop-url" />
        <button type="button" id="post-link-site-drop-submit">Put my site on the homepage (15 min)</button>
      </div>
      <form id="site-drop-form">
        <input id="site-drop-url" />
      </form>
    `;
    document.documentElement.setAttribute('data-vr-has-link', '1');
    initSiteDropForm();
    const input = document.getElementById('post-link-site-drop-url') as HTMLInputElement;
    input.dispatchEvent(new Event('paste', { bubbles: true }));
    input.value = 'own.example';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect((document.getElementById('site-drop-url') as HTMLInputElement).value).toBe('own.example');
    expect(document.getElementById('site-drop-status')?.textContent).toBe('Get your referral link first.');
    document.documentElement.removeAttribute('data-vr-has-link');
  });
});
