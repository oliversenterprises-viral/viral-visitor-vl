import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wireBannerStatsQuick } from '../../src/admin/banner-stats';
import { wireVisitorFunnelStatsQuick } from '../../src/admin/visitor-funnel-stats';
import { BANNER_EVENTS_KEY } from '../../src/content';
import { clearAdminSessionToken } from '../../src/lib/admin-session';

const bannerEvent = {
  type: 'impression',
  label: 'Promo',
  redirectUrl: 'https://example.com',
  key: 'Promo|https://example.com',
  timestamp: '2026-06-22T12:00:00Z',
};

const visitorEvent = {
  event_name: 'SiteLanding',
  visitor_id: 'v-test-1',
  country_code: 'US',
  created_at: '2026-06-22T12:00:00Z',
};

function editContentRoot(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'admin-content';
  root.innerHTML = `
    <div id="visitor-stats-quick" class="mb-4 p-3 border border-violet-500/30 bg-zinc-900/50 rounded-2xl"></div>
    <div id="banner-stats-quick" class="mb-4 p-3 border border-emerald-500/30 bg-zinc-900/50 rounded-2xl"></div>
  `;
  return root;
}

describe('stats panel refresh vs CSV clicks', () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    clearAdminSessionToken();
    anchorClick = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClick);
    createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  async function wireAll(root: HTMLElement) {
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([bannerEvent]));
    localStorage.setItem('viralrefer_visitor_events', JSON.stringify([visitorEvent]));
    await Promise.all([
      wireVisitorFunnelStatsQuick(root),
      wireBannerStatsQuick(root),
    ]);
  }

  it('visitor refresh does not download CSV', async () => {
    const root = editContentRoot();
    await wireAll(root);
    anchorClick.mockClear();
    createObjectURL.mockClear();

    const refresh = root.querySelector('[data-visitor-stats-refresh]') as HTMLButtonElement;
    expect(refresh).toBeTruthy();
    refresh.click();

    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('banner refresh does not download CSV', async () => {
    const root = editContentRoot();
    await wireAll(root);
    anchorClick.mockClear();
    createObjectURL.mockClear();

    const refresh = root.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement;
    refresh.click();

    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('visitor CSV button still downloads', async () => {
    const root = editContentRoot();
    await wireAll(root);
    anchorClick.mockClear();

    const csv = root.querySelector('[data-visitor-stats-csv]') as HTMLButtonElement;
    csv.click();

    expect(anchorClick).toHaveBeenCalledTimes(1);
  });
});