/** NovaCodeSwarm-Goal closure: steps 4+6 — shipped admin stats render/wire entry points on real DOM. */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBannerStats, wireBannerStatsQuick } from '../../src/admin/banner-stats';
import {
  renderVisitorFunnelStats,
  wireVisitorFunnelStatsQuick,
} from '../../src/admin/visitor-funnel-stats';
import { BANNER_EVENTS_KEY } from '../../src/content';

const bannerEvent = {
  type: 'impression',
  label: 'Promo',
  redirectUrl: 'https://example.com',
  key: 'Promo|https://example.com',
  created_at: '2026-06-22T12:00:00Z',
};

const visitorEvent = {
  event_name: 'SiteLanding',
  visitor_id: 'v-test-1',
  country_code: 'US',
  utm_source: 'direct',
  metadata: { client_ip: '8.8.8.8' },
  created_at: '2026-06-22T12:00:00Z',
};

function editContentQuickStatsRoot(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div id="visitor-stats-quick" class="mb-4 p-3 border border-violet-500/30 bg-zinc-900/50 rounded-2xl"></div>
    <div id="banner-stats-quick" class="mb-4 p-3 border border-emerald-500/30 bg-zinc-900/50 rounded-2xl"></div>
  `;
  return root;
}

describe('admin stats public API (shipped render/wire)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderBannerStats renders panel markup from preloaded events', async () => {
    const el = document.createElement('div');
    await renderBannerStats(el, [bannerEvent]);
    expect(el.classList.contains('banner-stats-panel')).toBe(true);
    expect(el.innerHTML).toContain('Banner Performance');
    expect(el.innerHTML).toContain('data-banner-stats-autorefresh');
    expect(el.innerHTML).toContain('LOCAL');
    expect(el.innerHTML).toContain('Promo');
    expect(el.innerHTML).toContain('Latest event');
  });

  it('renderVisitorFunnelStats renders panel markup from preloaded events', async () => {
    const el = document.createElement('div');
    await renderVisitorFunnelStats(el, [visitorEvent, { ...visitorEvent, event_name: 'SubmitPrizeClaim' }]);
    expect(el.classList.contains('visitor-funnel-stats-panel')).toBe(true);
    expect(el.innerHTML).toContain('Site Visitor Funnel');
    expect(el.innerHTML).toContain('LOCAL');
    expect(el.innerHTML).toContain('Landings');
    expect(el.innerHTML).toContain('data-visitor-stats-autorefresh');
    expect(el.innerHTML).toContain('Latest event');
    expect(el.innerHTML).toContain('Recent events');
    expect(el.innerHTML).toContain('8.8.8.8');
  });

  it('wireBannerStatsQuick wires #banner-stats-quick without runtime error', async () => {
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([bannerEvent]));
    const root = editContentQuickStatsRoot();
    await expect(wireBannerStatsQuick(root)).resolves.toBeUndefined();
    const panel = root.querySelector('#banner-stats-quick') as HTMLElement;
    expect(panel.innerHTML).toContain('Banner Performance');
    expect(panel.innerHTML).not.toContain('skeleton');
  });

  it('wireVisitorFunnelStatsQuick wires #visitor-stats-quick without runtime error', async () => {
    localStorage.setItem('viralrefer_visitor_events', JSON.stringify([visitorEvent]));
    const root = editContentQuickStatsRoot();
    await expect(wireVisitorFunnelStatsQuick(root)).resolves.toBeUndefined();
    const panel = root.querySelector('#visitor-stats-quick') as HTMLElement;
    expect(panel.innerHTML).toContain('Site Visitor Funnel');
    expect(panel.innerHTML).not.toContain('skeleton');
  });

  it('visitor and banner quick panels render together on shared edit-content root', async () => {
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([bannerEvent]));
    localStorage.setItem('viralrefer_visitor_events', JSON.stringify([visitorEvent]));
    const root = editContentQuickStatsRoot();
    await wireVisitorFunnelStatsQuick(root);
    await wireBannerStatsQuick(root);
    expect(root.querySelector('#visitor-stats-quick')!.innerHTML).toContain('Site Visitor Funnel');
    expect(root.querySelector('#banner-stats-quick')!.innerHTML).toContain('Banner Performance');
  });
});