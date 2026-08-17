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
  isAdminStatsMoreOpen,
  setAdminMore,
  syncAdminTabCoach,
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
    <div id="admin-live-hub" class="hidden">
      <span>What's happening now</span>
      <button>Referrals</button>
      <button>Shares</button>
      <button>Funnel</button>
      <button>Banners</button>
      <button>Claims</button>
      <button>CMS</button>
      <button>Landings</button>
    </div>
    <div class="admin-tab-bar">
      <button class="admin-tab" data-admin-tab="0" data-vr-admin-extra="1">Friends</button>
      <button class="admin-tab" data-admin-tab="3" data-vr-admin-extra="1">Prize</button>
      <button class="admin-tab" data-admin-tab="2" data-vr-admin-extra="1">Website</button>
    </div>
    <p id="admin-tab-coach"></p>
    <button id="admin-stats-more-btn" type="button">More numbers</button>
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

  it('treats every owner tab as extra so first screen is desk-only', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([]);
    expect(ADMIN_EXTRA_TABS).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(isAdminExtraTab(0)).toBe(true);
    expect(isAdminExtraTab(2)).toBe(true);
    expect(isAdminExtraTab(3)).toBe(true);
  });

  it('relocates Friends / Prize / Website and the live hub out of the first screen', () => {
    initAdminDesk();
    const content = document.getElementById('admin-content') as HTMLElement;
    renderOwnerFunnelDeskView(content, {
      windowDays: 7,
      landings: 0,
      getLink: 0,
      share: 0,
      locked: 0,
      getLinkRate: '0%',
      feed: [],
    });

    const first = firstScreenHtml();
    expect(first).toMatch(/Landings/);
    expect(first).toMatch(/Get-link/);
    expect(first).toMatch(/Share/);
    expect(first).toMatch(/Locked/);
    expect(first).toMatch(/Get-link rate/);
    expect(first).not.toMatch(/Friends/);
    expect(first).not.toMatch(/Prize/);
    expect(first).not.toMatch(/Website/);
    expect(first).not.toMatch(/What.?s happening now/i);
    expect(first).not.toMatch(/Referrals/);
    expect(first).not.toMatch(/Funnel/);
    expect(first).not.toMatch(/Banners/);
    expect(first).not.toMatch(/Claims/);
    expect(first).not.toMatch(/\bCMS\b/);

    const more = document.getElementById('admin-more-tools-btn');
    expect(more).not.toBeNull();
    expect(more?.hasAttribute('hidden')).toBe(false);
    expect(more?.textContent).toMatch(/^More$/i);
    expect(document.getElementById('admin-more-tools-host')?.childElementCount).toBe(0);
    expect(document.getElementById('admin-live-hub')?.closest('#admin-more-tools-hold')).not.toBeNull();
    expect(document.getElementById('admin-live-hub')?.classList.contains('hidden')).toBe(true);
  });

  it('opens relocated extra tools from the visible More control', () => {
    initAdminSimple();
    expect(isAdminMoreOpen()).toBe(false);
    setAdminMore(true);
    expect(isAdminMoreOpen()).toBe(true);
    const host = document.getElementById('admin-more-tools-host');
    expect(host?.querySelector('#admin-live-hub')).not.toBeNull();
    expect(host?.textContent).toMatch(/Friends/);
    expect(host?.textContent).toMatch(/Prize/);
    expect(host?.textContent).toMatch(/Website/);
    expect(document.getElementById('admin-live-hub')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('admin-more-tools-btn')?.textContent).toMatch(/Back to desk/i);
    expect(document.getElementById('admin-more-tools-btn')?.hasAttribute('hidden')).toBe(false);

    setAdminMore(false);
    expect(isAdminMoreOpen()).toBe(false);
    expect(document.getElementById('admin-more-tools-host')?.childElementCount).toBe(0);
    expect(document.getElementById('admin-live-hub')?.closest('#admin-more-tools-hold')).not.toBeNull();
    expect(document.getElementById('admin-live-hub')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('admin-more-tools-btn')?.textContent).toMatch(/^More$/i);
  });

  it('does not CSS-hide first-screen chrome via the old desk attribute', () => {
    initAdminDesk();
    expect(document.documentElement.getAttribute('data-vr-admin-simple')).toBe('1');
    expect(document.documentElement.hasAttribute('data-vr-admin-desk')).toBe(false);
    expect(isAdminMoreOpen()).toBe(false);
    expect(isAdminStatsMoreOpen()).toBe(false);
  });

  it('writes a loop coach line for the desk', () => {
    initAdminSimple();
    syncAdminTabCoach(-1);
    expect(document.getElementById('admin-tab-coach')?.textContent).toMatch(/get a link/i);
  });

  it('keeps first-screen HTML in index.html desk-only with extra Prize/Website tabs', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const modalStart = html.indexOf('id="admin-modal"');
    const holdStart = html.indexOf('id="admin-more-tools-hold"');
    expect(modalStart).toBeGreaterThan(-1);
    expect(holdStart).toBeGreaterThan(modalStart);
    const modal = html.slice(modalStart, holdStart);
    expect(modal).toMatch(/Landings/);
    expect(modal).toMatch(/Get-link/);
    expect(modal).toMatch(/>Share</);
    expect(modal).toMatch(/Locked/);
    expect(modal).toMatch(/Get-link rate/);
    expect(modal).toMatch(/>More</);
    expect(modal).not.toMatch(/Friends/);
    expect(modal).not.toMatch(/Prize/);
    expect(modal).not.toMatch(/Website/);
    expect(modal).not.toMatch(/What.?s happening now/);
    expect(modal).not.toMatch(/Referrals/);
    expect(modal).not.toMatch(/Funnel/);
    expect(modal).not.toMatch(/Banners/);
    expect(modal).not.toMatch(/Claims/);
    expect(modal).not.toMatch(/\bCMS\b/);
    expect(html).toMatch(/id="tab-0"[^>]*data-vr-admin-extra="1"/);
    expect(html).toMatch(/id="tab-2"[^>]*data-vr-admin-extra="1"/);
    expect(html).toMatch(/id="tab-3"[^>]*data-vr-admin-extra="1"/);
  });

  it('does not start or unhide the live hub on admin open', () => {
    const modals = readFileSync(resolve(__dirname, '../../src/public/modals.ts'), 'utf8');
    const openStart = modals.indexOf("registerGlobal('openAdminPanel'");
    const openEnd = modals.indexOf('});', openStart);
    const openFn = modals.slice(openStart, openEnd);
    expect(openFn).not.toMatch(/startAdminLiveHub/);

    const hub = readFileSync(resolve(__dirname, '../../src/admin/admin-live-hub.ts'), 'utf8');
    const start = hub.indexOf('export function startAdminLiveHub');
    const stop = hub.indexOf('export function stopAdminLiveHub');
    const startFn = hub.slice(start, stop);
    expect(startFn).not.toMatch(/classList\.remove\(['"]hidden['"]\)/);
  });
});
