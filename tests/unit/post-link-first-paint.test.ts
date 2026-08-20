import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function sliceById(html: string, id: string, untilId?: string): string {
  const start = html.indexOf(`id="${id}"`);
  expect(start).toBeGreaterThan(0);
  if (!untilId) return html.slice(start);
  const end = html.indexOf(`id="${untilId}"`, start + 1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('post-link first paint', () => {
  it('keeps #32 hero first screen unchanged', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = sliceById(html, 'hero-title', 'funnel-journey');
    expect(hero).toMatch(/Win the homepage/);
    expect(hero).toMatch(/#1 puts their site on/);
    expect(hero).toContain('this page.');
    expect(hero).toMatch(
      /Tap Get my link\. Send it\. When a friend taps Get my link, you climb — and #1 owns this slot for 7 days/,
    );
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(hero).toContain('Get my referral link');
    expect(hero).not.toContain('See leaderboard');
    expect(hero).not.toContain('id="hero-leaderboard-btn"');
    expect(hero).not.toContain('Telegram');
    expect(hero).not.toContain('id="promoter-week-strip"');
  });

  it('post-link stack is You\'re racing + Send it now + Copy link, no status node', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const stack = sliceById(html, 'referral-section', 'my-stats');
    expect(stack).not.toContain('id="post-link-status"');
    expect(stack).not.toContain("You're in.");
    expect(stack).toContain('id="ref-link"');
    expect(stack).toContain("You're racing.");
    expect(stack).toContain("Send it now. A friend must tap Get my link — that's how you climb.");
    expect(stack).toContain('id="post-link-share"');
    expect(stack).toContain('id="post-link-primary"');
    expect(stack).toContain('id="post-link-copy"');
    expect(stack).toContain('Copy link');
    const banned = [
      'Step 2: tap COPY',
      'id="viral-power-meter"',
      'id="daily-share-quest"',
      'id="duel-invite-strip"',
      'id="share-ab-wrap"',
      'id="share-buttons-panel"',
      'id="share-tools-row"',
      'id="referral-qr-block"',
      'id="kid-more-tools-btn"',
      'id="share-more-options-btn"',
      'id="growth-command-center"',
      'id="rank-receipt-cta"',
      'id="catch-up-anxiety-bar"',
      'id="promo-kit"',
      'Challenge a friend',
      'Viral Power',
      'A/B message test',
      'More platforms',
    ];
    for (const id of banned) {
      expect(stack, id).not.toContain(id);
    }
  });

  it('legacy toolkit is gone from the visitor homepage, not CSS-hidden', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('id="visitor-legacy-toolkit"');
    expect(html).not.toContain('id="viral-power-meter"');
    expect(html).not.toContain('id="share-buttons-panel"');
    expect(html).not.toContain('id="referral-qr-block"');
    expect(html).not.toContain('id="daily-share-quest"');
    expect(html).not.toContain('id="share-ab-wrap"');
    expect(html).not.toContain('id="growth-command-center"');
    expect(html).not.toContain('Step 2: tap COPY');
  });

  it('has-link does not resurrect toolkit chrome', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).not.toMatch(/#visitor-legacy-toolkit/);
    expect(css).toMatch(/html\[data-vr-has-link\] #funnel-journey/);
    expect(css).toMatch(/html\[data-vr-has-link\] #kid-more-tools-btn/);
    expect(css).not.toMatch(/html\[data-vr-post-link-one\] #post-link-status/);
    expect(css).toMatch(
      /html\[data-vr-post-link-status\]:not\(\[data-vr-post-link-one\]\) #post-link-heading/,
    );
  });

  it('three quiet status strings exist in i18n', () => {
    const messages = readFileSync(resolve(ROOT, 'src/lib/i18n/messages.ts'), 'utf8');
    expect(messages).toContain("You're in.");
    expect(messages).toContain('Send this. A friend must tap Get my link.');
    expect(messages).toContain("'post_link.status_waiting': 'Waiting'");
    expect(messages).toContain('1 friend must tap Get my link');
    expect(messages).toContain("'post_link.status_locked': 'Locked'");
    expect(messages).toContain("A friend tapped Get my link. You're on the board.");
    expect(messages).toContain('Link copied. A friend still has to tap Get my link.');
  });
});
