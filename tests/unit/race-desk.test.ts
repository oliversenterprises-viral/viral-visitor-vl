import { describe, expect, it } from 'vitest';
import {
  LIVE_PRIZE_WINNER_KEY,
  RACE_TEXT_SPOTS_KEY,
  buildRaceDeskSnapshot,
  emptyRaceDeskSnapshot,
  hideLivePrizeWinner,
  hideRaceTextSpot,
  parseLivePrizeWinner,
  parseRaceTextSpots,
  renderRaceDeskView,
  unhideRaceTextSpot,
} from '../../src/admin/race-desk';

const NOW = new Date('2026-09-02T12:00:00.000Z');

describe('race desk (Owner HQ Race tab)', () => {
  it('parses live_prize_winner and race_text_spots from get_site_content map', () => {
    const snap = buildRaceDeskSnapshot(
      {
        [LIVE_PRIZE_WINNER_KEY]: {
          label: 'Paint',
          url: 'https://paint.example',
          expiresAt: '2026-09-09T12:00:00.000Z',
          code: 'VIRAL-PAINT01',
        },
        [RACE_TEXT_SPOTS_KEY]: {
          spots: [
            { code: 'VIRAL-A', label: 'A', url: 'https://a.example', locks: 2 },
            { code: 'VIRAL-B', label: 'B', url: 'https://b.example', locks: 1, hidden: true },
          ],
        },
      },
      NOW,
    );
    expect(snap.banner.empty).toBeFalsy();
    if (snap.banner.empty === true) throw new Error('expected live banner');
    expect(snap.banner.label).toBe('Paint');
    expect(snap.banner.url).toBe('https://paint.example/');
    expect(snap.spots).toHaveLength(2);
    expect(snap.spots[1].hidden).toBe(true);
    expect(snap.countdown).toMatch(/This week's race ends/);
    expect(snap.expiryLine).toMatch(/00:00 UTC/);
  });

  it('treats missing or empty winner as an empty banner', () => {
    expect(parseLivePrizeWinner({ empty: true }, NOW)).toBeNull();
    expect(emptyRaceDeskSnapshot(NOW).banner).toEqual({ empty: true });
    expect(parseRaceTextSpots(null).spots).toEqual([]);
  });

  it('hides the banner and a text spot without dropping the slot', () => {
    const winner = parseLivePrizeWinner(
      {
        label: 'Paint',
        url: 'https://paint.example',
        expiresAt: '2026-09-09T12:00:00.000Z',
      },
      NOW,
    );
    expect(winner).not.toBeNull();
    expect(hideLivePrizeWinner(winner!).hidden).toBe(true);
    const hidden = hideRaceTextSpot(
      { spots: [{ code: 'VIRAL-A', label: 'A', url: 'https://a.example', locks: 1 }] },
      'VIRAL-A',
    );
    expect(hidden.spots[0].hidden).toBe(true);
    expect(unhideRaceTextSpot(hidden, 'VIRAL-A').spots[0].hidden).toBe(false);
  });

  it('paints live Race copy for empty and live states', () => {
    const el = document.createElement('div');
    renderRaceDeskView(el, emptyRaceDeskSnapshot(NOW));
    expect(el.textContent).toMatch(/Race/);
    expect(el.textContent).toMatch(/Unclaimed prizes die Monday/);
    expect(el.textContent).toMatch(/You do not approve/);
    expect(el.querySelector('[data-race-banner="empty"]')).toBeTruthy();
    expect(el.textContent).toMatch(/No text lines this week/);

    renderRaceDeskView(
      el,
      buildRaceDeskSnapshot(
        {
          [LIVE_PRIZE_WINNER_KEY]: {
            label: 'Paint',
            url: 'https://paint.example',
            expiresAt: '2026-09-09T12:00:00.000Z',
          },
        },
        NOW,
      ),
    );
    expect(el.querySelector('[data-race-banner="live"]')).toBeTruthy();
    expect(el.textContent).toContain('Hide this banner');
    expect(el.textContent).toContain('Hide banner');
  });
});
