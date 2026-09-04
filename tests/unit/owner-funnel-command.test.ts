import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hqAgoLabel,
  hqCommandCopyIsDeskSafe,
  hqCommandOrder,
  hqDefaultFeedFilter,
  hqLoopHoleStep,
  hqLoopSteps,
  hqViaMix,
} from '../../src/admin/owner-funnel-command';
import { applyHqDeskFilter, renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';
import { initAdminDesk } from '../../src/lib/admin-simple';
import type { OwnerFunnelDeskMetrics } from '../../src/admin/owner-funnel-desk-helpers';
import { emptyOwnerFunnelGsc, parseOwnerFunnelGsc } from '../../src/admin/owner-funnel-desk-helpers';

const root = resolve(import.meta.dirname, '../..');
const NOW = Date.parse('2026-08-16T18:00:00Z');

function metrics(partial: Partial<OwnerFunnelDeskMetrics> = {}): OwnerFunnelDeskMetrics {
  return {
    windowDays: 7,
    visits: 0,
    friendLandings: 0,
    landings: 0,
    getLink: 0,
    share: 0,
    locked: 0,
    getLinkRate: '0%',
    feed: [],
    gsc: emptyOwnerFunnelGsc(),
    ...partial,
  };
}

describe('HQ Command order', () => {
  it('names Search Console as the hole when tiles are zero and the secret is missing', () => {
    const order = hqCommandOrder(metrics());
    expect(order.id).toBe('gsc-blind');
    expect(order.severity).toBe('blind');
    expect(hqCommandCopyIsDeskSafe(order)).toBe(true);
    expect(hqLoopHoleStep(order.id)).toBe('visits');
  });

  it('flags Google taps with zero desk visits', () => {
    const order = hqCommandOrder(
      metrics({
        gsc: parseOwnerFunnelGsc({ status: 'ok', clicks: 12, impressions: 80 }),
      }),
    );
    expect(order.id).toBe('gsc-without-visits');
    expect(order.title).toMatch(/Google shows taps/i);
    expect(hqCommandCopyIsDeskSafe(order)).toBe(true);
  });

  it('names the /r/ hole, then Get-link, then Send, then lock', () => {
    expect(
      hqCommandOrder(metrics({ visits: 40, gsc: parseOwnerFunnelGsc({ status: 'ok', clicks: 0 }) })).id,
    ).toBe('no-friend-land');
    expect(
      hqCommandOrder(
        metrics({
          visits: 40,
          friendLandings: 10,
          landings: 10,
          getLink: 2,
          getLinkRate: '20.0%',
          gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        }),
      ).id,
    ).toBe('land-no-getlink');
    expect(
      hqCommandOrder(
        metrics({
          visits: 40,
          friendLandings: 10,
          landings: 10,
          getLink: 8,
          share: 0,
          getLinkRate: '80.0%',
          gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        }),
      ).id,
    ).toBe('getlink-no-send');
    expect(
      hqCommandOrder(
        metrics({
          visits: 40,
          friendLandings: 10,
          landings: 10,
          getLink: 8,
          share: 3,
          locked: 0,
          getLinkRate: '80.0%',
          gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        }),
      ).id,
    ).toBe('send-no-lock');
    expect(
      hqCommandOrder(
        metrics({
          visits: 80,
          friendLandings: 20,
          landings: 20,
          getLink: 16,
          share: 2,
          locked: 1,
          getLinkRate: '80.0%',
          gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        }),
      ).id,
    ).toBe('loop-thin-send');
    expect(
      hqCommandOrder(
        metrics({
          visits: 80,
          friendLandings: 20,
          landings: 20,
          getLink: 16,
          share: 8,
          locked: 4,
          getLinkRate: '80.0%',
          gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        }),
      ).id,
    ).toBe('loop-closing');
  });

  it('never puts More-only labels in the order copy', () => {
    const samples: OwnerFunnelDeskMetrics[] = [
      metrics(),
      metrics({ visits: 12, gsc: parseOwnerFunnelGsc({ status: 'ok' }) }),
      metrics({
        visits: 12,
        friendLandings: 4,
        landings: 4,
        getLink: 1,
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
      }),
      metrics({
        visits: 12,
        friendLandings: 4,
        landings: 4,
        getLink: 3,
        share: 1,
        locked: 1,
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
      }),
    ];
    for (const row of samples) {
      const order = hqCommandOrder(row);
      expect(hqCommandCopyIsDeskSafe(order)).toBe(true);
      expect(order.title).not.toMatch(/Funnel|Friends|Prize|Website|Promoters|Referrals/i);
      expect(order.detail).not.toMatch(/Funnel|Friends|Prize|Website|Promoters|Referrals/i);
    }
  });

  it('marks one loop hole and keeps five steps, not extra tiles', () => {
    const steps = hqLoopSteps(
      metrics({
        visits: 40,
        friendLandings: 10,
        landings: 10,
        getLink: 2,
        share: 0,
        locked: 0,
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
      }),
    );
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.id)).toEqual(['visits', 'landings', 'getlink', 'share', 'locked']);
    expect(steps.filter((s) => s.hole)).toHaveLength(1);
    expect(steps.find((s) => s.hole)?.id).toBe('getlink');
    expect(steps.find((s) => s.id === 'getlink')?.rate).toBe('20.0%');
    expect(steps.find((s) => s.id === 'getlink')?.drop).toBe(8);
  });

  it('puts via mix and last-event evidence on the order', () => {
    const order = hqCommandOrder(
      metrics({
        visits: 40,
        friendLandings: 10,
        landings: 10,
        getLink: 2,
        getLinkRate: '20.0%',
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        feed: [
          {
            kind: 'landed',
            label: 'Landed',
            at: '2026-08-16T16:00:00Z',
            via: 'friend',
            viaLabel: "/r/",
          },
          {
            kind: 'landed',
            label: 'Landed',
            at: '2026-08-16T15:00:00Z',
            via: 'direct',
            viaLabel: 'direct',
          },
        ],
      }),
      NOW,
    );
    expect(order.id).toBe('land-no-getlink');
    expect(order.evidence).toContain('Last /r/ land 2h ago');
    expect(order.evidence).toContain('Via mix: 1 direct');
    expect(order.evidence).toContain('/r/');
    expect(order.evidence).toContain('/a/');
    expect(order.evidence).toContain('No Get-link in the log');
    expect(hqCommandCopyIsDeskSafe(order)).toBe(true);
    expect(
      hqViaMix([
        {
          kind: 'landed',
          label: 'Landed',
          at: '2026-08-16T16:00:00Z',
          via: 'friend',
          viaLabel: '/r/',
        },
        {
          kind: 'landed',
          label: 'Landed',
          at: '2026-08-16T15:00:00Z',
          via: 'direct',
          viaLabel: 'direct',
        },
      ]),
    ).toEqual({ direct: 1, friend: 1, promoter: 0 });
    expect(hqAgoLabel('2026-08-16T16:00:00Z', NOW)).toBe('2h ago');
    expect(hqDefaultFeedFilter(metrics({
      visits: 40,
      friendLandings: 10,
      landings: 10,
      getLink: 2,
      gsc: parseOwnerFunnelGsc({ status: 'ok' }),
    }))).toBe('got_link');
  });

  it('paints order + loop without adding a seventh tile', () => {
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(
      el,
      metrics({
        visits: 40,
        friendLandings: 10,
        landings: 10,
        getLink: 8,
        share: 0,
        locked: 0,
        getLinkRate: '80.0%',
        gsc: parseOwnerFunnelGsc({ status: 'ok', clicks: 4 }),
      }),
    );
    expect(el.querySelector('[data-hq-command-order]')?.getAttribute('data-hq-command-order')).toBe(
      'getlink-no-send',
    );
    expect(el.querySelector('[data-hq-loop]')).not.toBeNull();
    expect(el.querySelector('[data-hq-loop-hole]')?.getAttribute('data-hq-loop-step')).toBe('share');
    expect(el.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(6);
    expect(el.querySelectorAll('[data-hq-loop-step]').length).toBe(5);
    expect(el.textContent).toMatch(/Links mint/);
    expect(el.textContent).not.toMatch(/Prize|Website|Promoters|What.?s happening now|More numbers/i);
    expect(el.querySelector('[data-hq-desk-updated]')?.textContent).toMatch(/Updated just now/);
    expect(el.querySelector('[data-hq-gsc-lists]')).not.toBeNull();
    expect(el.querySelectorAll('[data-hq-feed-filter]').length).toBe(5);
  });

  it('filters the log from a loop step and from 1–4 keys', () => {
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(
      el,
      metrics({
        visits: 40,
        friendLandings: 10,
        landings: 10,
        getLink: 8,
        share: 3,
        locked: 1,
        getLinkRate: '80.0%',
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        feed: [
          {
            kind: 'landed',
            label: 'Landed',
            at: '2026-08-16T16:00:00Z',
            via: 'friend',
            viaLabel: '/r/',
          },
          {
            kind: 'got_link',
            label: 'Got a link',
            at: '2026-08-16T16:10:00Z',
            via: 'friend',
            viaLabel: '/r/',
          },
          {
            kind: 'shared',
            label: 'Shared',
            at: '2026-08-16T16:20:00Z',
            via: 'direct',
            viaLabel: 'direct',
          },
          {
            kind: 'locked',
            label: 'Locked',
            at: '2026-08-16T16:30:00Z',
            via: 'friend',
            viaLabel: '/r/',
            code: 'VIRAL-REAL1',
            friendCode: 'VIRAL-FRIEND1',
          },
        ],
      }),
    );
    expect(hqDefaultFeedFilter(metrics({
      visits: 40,
      friendLandings: 10,
      landings: 10,
      getLink: 8,
      share: 3,
      locked: 1,
      gsc: parseOwnerFunnelGsc({ status: 'ok' }),
    }))).toBe('all');
    expect([...el.querySelectorAll('[data-hq-feed-kind]')].every((row) => !(row as HTMLElement).hidden)).toBe(
      true,
    );

    applyHqDeskFilter(el, 'shared');
    expect(el.dataset.hqDeskFilter).toBe('shared');
    expect((el.querySelector('[data-hq-feed-kind="shared"]') as HTMLElement).hidden).toBe(false);
    expect((el.querySelector('[data-hq-feed-kind="landed"]') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('[data-hq-loop-step="share"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-hq-feed-filter="shared"]')?.classList.contains('hq-feed-filter--on')).toBe(
      true,
    );

    const landingsStep = el.querySelector('[data-hq-loop-step="landings"]');
    expect(landingsStep).not.toBeNull();
    landingsStep?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(el.dataset.hqDeskFilter).toBe('landed');
    expect((el.querySelector('[data-hq-feed-kind="landed"]') as HTMLElement).hidden).toBe(false);
    expect((el.querySelector('[data-hq-feed-kind="locked"]') as HTMLElement).hidden).toBe(true);

    applyHqDeskFilter(el, 'got_link');
    expect(el.querySelector('[data-hq-feed-empty]')?.textContent).not.toMatch(/No Got a link/);
  });
});

describe('HQ Command keys', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
    document.body.innerHTML = `
      <div id="admin-modal">
        <button type="button" id="admin-more-tools-btn">More</button>
        <div id="admin-more-tools-host"></div>
        <div id="admin-content"></div>
      </div>
      <div id="admin-more-tools-hold" hidden></div>
    `;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
  });

  it('R clicks Refresh on the open desk and ignores it in a field', () => {
    initAdminDesk();
    const content = document.getElementById('admin-content') as HTMLElement;
    renderOwnerFunnelDeskView(content, metrics());
    const btn = content.querySelector('[data-owner-desk-refresh]') as HTMLButtonElement;
    let clicks = 0;
    btn.addEventListener('click', () => {
      clicks += 1;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(clicks).toBe(1);

    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(clicks).toBe(1);
  });

  it('number keys 1–4 filter the log and 0 shows all', () => {
    initAdminDesk();
    const content = document.getElementById('admin-content') as HTMLElement;
    renderOwnerFunnelDeskView(
      content,
      metrics({
        visits: 12,
        friendLandings: 4,
        landings: 4,
        getLink: 3,
        share: 1,
        locked: 1,
        getLinkRate: '75.0%',
        gsc: parseOwnerFunnelGsc({ status: 'ok' }),
        feed: [
          {
            kind: 'landed',
            label: 'Landed',
            at: '2026-08-16T16:00:00Z',
            via: 'friend',
            viaLabel: '/r/',
          },
          {
            kind: 'shared',
            label: 'Shared',
            at: '2026-08-16T16:20:00Z',
            via: 'direct',
            viaLabel: 'direct',
          },
        ],
      }),
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(content.dataset.hqDeskFilter).toBe('landed');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(content.dataset.hqDeskFilter).toBe('shared');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    expect(content.dataset.hqDeskFilter).toBe('all');
  });
});

describe('HQ Command first-paint chrome', () => {
  it('keeps More/close named without leaking extra tools onto the first screen', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const modal = html.slice(html.indexOf('id="admin-modal"'), html.indexOf('id="admin-more-tools-hold"'));
    expect(modal).toMatch(/aria-label="More HQ tools"/);
    expect(modal).toMatch(/aria-label="Close HQ Command"/);
    expect(modal).toMatch(/data-hq-command-order="gsc-blind"/);
    expect(modal).toMatch(/data-hq-loop/);
    expect(modal).toMatch(/data-hq-feed-filter="all"/);
    expect(modal).toMatch(/Search lists/);
    expect(modal).toMatch(/Six numbers\. One hole\. Server only\./);
    expect(modal).not.toMatch(/What's happening now/);
    expect(modal).not.toMatch(/More numbers/);
  });
});
