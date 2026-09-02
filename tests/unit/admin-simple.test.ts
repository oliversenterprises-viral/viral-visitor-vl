import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EXTRA_TABS,
  ADMIN_PRIMARY_TABS,
  initAdminDesk,
  initAdminSimple,
  isAdminExtraTab,
  isAdminMoreOpen,
  setAdminMore,
} from '../../src/lib/admin-simple';
import { renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';

const MODAL_FIXTURE = `
  <div id="admin-modal">
    <div class="vr-modal-panel">
      <div>
        <div>Run the funnel</div>
        <button id="admin-more-tools-btn" type="button">More</button>
      </div>
      <div id="admin-more-tools-host"></div>
      <div id="admin-content"></div>
    </div>
  </div>
  <div id="admin-more-tools-hold" hidden>
    <div class="admin-tab-bar">
      <button class="admin-tab" data-admin-tab="3" data-vr-admin-extra="1">Prize</button>
      <button class="admin-tab" data-admin-tab="2" data-vr-admin-extra="1">Website</button>
      <button class="admin-tab" data-admin-tab="6" data-vr-admin-extra="1">Promoters</button>
    </div>
  </div>
`;

function firstScreenHtml(): string {
  const modal = document.getElementById('admin-modal');
  return modal?.innerHTML || '';
}

describe('admin one-loop desk', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-desk');
    document.documentElement.removeAttribute('data-vr-admin-more');
    document.documentElement.removeAttribute('data-vr-admin-stats-more');
    document.body.innerHTML = MODAL_FIXTURE;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-desk');
    document.documentElement.removeAttribute('data-vr-admin-more');
  });

  it('treats only Prize, Website, and Promoters as extra so first screen is desk-only', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([]);
    expect(ADMIN_EXTRA_TABS).toEqual([2, 3, 6]);
    expect(isAdminExtraTab(2)).toBe(true);
    expect(isAdminExtraTab(3)).toBe(true);
    expect(isAdminExtraTab(0)).toBe(false);
    expect(isAdminExtraTab(1)).toBe(false);
    expect(isAdminExtraTab(6)).toBe(true);
  });

  it('keeps first screen to six tiles, one feed, and visible More', () => {
    initAdminDesk();
    const content = document.getElementById('admin-content') as HTMLElement;
    renderOwnerFunnelDeskView(content, {
      windowDays: 7,
      visits: 0,
      friendLandings: 0,
      landings: 0,
      getLink: 0,
      share: 0,
      locked: 0,
      getLinkRate: '0%',
      feed: [],
    });

    const first = firstScreenHtml();
    expect(first).toMatch(/Visits/);
    expect(first).toMatch(/Friend landings/);
    expect(first).toMatch(/Get-link/);
    expect(first).toMatch(/Share/);
    expect(first).toMatch(/Locked/);
    expect(first).toMatch(/Get-link rate/);
    expect(content.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(6);
    expect(content.querySelector('[data-owner-desk-gsc]')).not.toBeNull();
    expect(first).toMatch(/Google Search · tools & pages/);
    expect(first).toMatch(/Search Console is verified\. Add the API key on the server to show numbers here\./);
    expect(first).not.toMatch(/Friends/);
    expect(first).not.toMatch(/Prize/);
    expect(first).not.toMatch(/Website/);
    expect(first).not.toMatch(/Promoters/);
    expect(first).not.toMatch(/What.?s happening now/i);
    expect(first).not.toMatch(/Referrals/);
    expect(first).not.toMatch(/Funnel/);
    expect(first).not.toMatch(/Banners/);
    expect(first).not.toMatch(/Claims/);
    expect(first).not.toMatch(/\bCMS\b/);
    expect(first).not.toMatch(/More numbers/i);

    const more = document.getElementById('admin-more-tools-btn');
    expect(more).not.toBeNull();
    expect(more?.hasAttribute('hidden')).toBe(false);
    expect(more?.textContent).toMatch(/^More$/i);
    expect(document.getElementById('admin-more-tools-host')?.childElementCount).toBe(0);
    expect(document.getElementById('admin-live-hub')).toBeNull();
  });

  it('opens only Prize, Website, and Promoters from the visible More control', () => {
    initAdminSimple();
    expect(isAdminMoreOpen()).toBe(false);
    setAdminMore(true);
    expect(isAdminMoreOpen()).toBe(true);
    const host = document.getElementById('admin-more-tools-host');
    expect(host?.textContent).toMatch(/Prize/);
    expect(host?.textContent).toMatch(/Website/);
    expect(host?.textContent).toMatch(/Promoters/);
    expect(host?.textContent).not.toMatch(/Friends/);
    expect(host?.textContent).not.toMatch(/Shares/);
    expect(host?.textContent).not.toMatch(/Colors/);
    expect(host?.textContent).not.toMatch(/Auto-pilot/);
    expect(host?.textContent).not.toMatch(/What.?s happening now/i);
    expect(host?.querySelectorAll('.admin-tab').length).toBe(3);
    expect(document.getElementById('admin-more-tools-btn')?.textContent).toMatch(/Back to desk/i);

    setAdminMore(false);
    expect(isAdminMoreOpen()).toBe(false);
    expect(document.getElementById('admin-more-tools-host')?.childElementCount).toBe(0);
    expect(document.getElementById('admin-more-tools-btn')?.textContent).toMatch(/^More$/i);
  });

  it('does not CSS-hide first-screen chrome via the old desk attribute', () => {
    initAdminDesk();
    expect(document.documentElement.getAttribute('data-vr-admin-simple')).toBe('1');
    expect(document.documentElement.hasAttribute('data-vr-admin-desk')).toBe(false);
    expect(isAdminMoreOpen()).toBe(false);
  });

  it('keeps first-screen HTML desk-only with More holding Prize, Website, and Promoters', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const modalStart = html.indexOf('id="admin-modal"');
    const holdStart = html.indexOf('id="admin-more-tools-hold"');
    expect(modalStart).toBeGreaterThan(-1);
    expect(holdStart).toBeGreaterThan(modalStart);
    const modal = html.slice(modalStart, holdStart);
    expect(modal).toMatch(/Visits/);
    expect(modal).toMatch(/Friend landings/);
    expect(modal).toMatch(/Get-link/);
    expect(modal).toMatch(/>Share</);
    expect(modal).toMatch(/Locked/);
    expect(modal).toMatch(/Get-link rate/);
    expect(modal).toMatch(/data-owner-desk-gsc/);
    expect(modal).toMatch(/Google Search · tools &amp; pages/);
    expect(modal).toMatch(/Shown in Google/);
    expect(modal).toMatch(/Tool pages/);
    expect(modal).toMatch(/Top searches/);
    expect(modal).toMatch(/Other pages/);
    expect(modal).toMatch(/Search countries/);
    expect(modal).toMatch(/Search Console is verified\. Add the API key on the server to show numbers here\./);
    expect(modal).toMatch(/HQ Command/);
    expect(modal).toMatch(/hq-desk-tile/);
    expect(modal).toMatch(/>More</);
    expect(modal).not.toMatch(/Friends/);
    expect(modal).not.toMatch(/Prize/);
    expect(modal).not.toMatch(/Website/);
    expect(modal).not.toMatch(/Promoters/);
    expect(modal).not.toMatch(/What.?s happening now/);
    expect(modal).not.toMatch(/More numbers/);

    const holdEnd = html.indexOf('id="winner-modal"');
    const hold = html.slice(holdStart, holdEnd);
    expect(hold).toMatch(/>Prize</);
    expect(hold).toMatch(/>Website</);
    expect(hold).toMatch(/>Promoters</);
    expect(hold).not.toMatch(/Friends/);
    expect(hold).not.toMatch(/Shares/);
    expect(hold).not.toMatch(/What.?s happening now/);
    expect(hold).not.toMatch(/id="admin-live-hub"/);
    expect(hold).not.toMatch(/id="tab-0"/);
    expect(hold).not.toMatch(/id="tab-1"/);
    expect(hold).not.toMatch(/id="tab-4"/);
    expect(hold).not.toMatch(/id="tab-5"/);
    expect(html).toMatch(/id="tab-6"[^>]*data-vr-admin-extra="1"/);
    expect(html).toMatch(/id="tab-2"[^>]*data-vr-admin-extra="1"/);
    expect(html).toMatch(/id="tab-3"[^>]*data-vr-admin-extra="1"/);
  });

  it('does not start a live hub on admin open', () => {
    const modals = readFileSync(resolve(__dirname, '../../src/public/modals.ts'), 'utf8');
    expect(modals).not.toMatch(/startAdminLiveHub/);
    expect(modals).not.toMatch(/admin-live-hub/);
    expect(modals).not.toMatch(/unlockAdminLiveSound/);
    const simple = readFileSync(resolve(__dirname, '../../src/lib/admin-simple.ts'), 'utf8');
    const switcher = readFileSync(resolve(__dirname, '../../src/admin/switcher.ts'), 'utf8');
    expect(simple).not.toMatch(/startAdminLiveHub/);
    expect(switcher).toMatch(/affiliates-tab/);
    expect(switcher).toMatch(/tab === 6/);
  });
});