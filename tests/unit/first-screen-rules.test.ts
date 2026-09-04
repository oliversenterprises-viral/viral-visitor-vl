import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOCKED_LIVE_FUNNEL_BADGE,
  LOCKED_LIVE_FUNNEL_STEP3,
  LOCKED_SITE_DROPS_CTA,
  LOCKED_SITE_DROPS_H1_ACCENT,
  LOCKED_SITE_DROPS_H1_LINE1,
  LOCKED_SITE_DROPS_RULE,
  LOCKED_SITE_DROPS_SLOT,
  LOCKED_SITE_DROPS_SUB,
  LOCKED_SITE_DROPS_TITLE,
} from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('first-screen Site Drops rules', () => {
  it('keeps the locked live Site Drops copy', () => {
    const html = read('index.html');
    expect(html).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_LINE1);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_ACCENT);
    expect(html).toContain(LOCKED_SITE_DROPS_SUB);
    expect(html).toContain(LOCKED_SITE_DROPS_SLOT);
    expect(html).toContain(LOCKED_SITE_DROPS_RULE);
    expect(html).toContain(LOCKED_SITE_DROPS_CTA);
    expect(html).toContain(`data-i18n="funnel.badge">${LOCKED_LIVE_FUNNEL_BADGE}</span>`);
    expect(html).toContain(`data-i18n="funnel.step3">${LOCKED_LIVE_FUNNEL_STEP3}</span>`);
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).not.toMatch(/\$\d|Cash App/i);
    expect(hero.toLowerCase()).not.toContain('cash prize');
  });

  it('keeps Get my referral link as the first-screen CTA', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(hero).toContain(LOCKED_SITE_DROPS_CTA);
    expect(hero).toContain('data-i18n="hero.cta_short">Get my link');
    expect((hero.match(/id="hero-get-link-btn"/g) || []).length).toBe(1);
    const btn = hero.slice(hero.indexOf('id="hero-get-link-btn"'), hero.indexOf('</button>', hero.indexOf('id="hero-get-link-btn"')));
    expect(btn.indexOf('hero.cta')).toBeLessThan(btn.indexOf('hero.cta_short'));
  });

  it('hides extra slot lines so the CTA fits 1280x800 and 390x844', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-ad-inventory/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-ad-race/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-slot-preview/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-ad-visit/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-week-clock/);
    expect(css).toMatch(/@media \(max-height: 820px\) and \(min-width: 1024px\)/);
    expect(css).toMatch(/@media \(max-width: 639px\)/);
    expect(css).not.toMatch(/html:not\(\[data-vr-has-link\]\) #site-drop-rungs/);
    expect(css).toMatch(/html:not\(\[data-vr-paid-landing\]\) #mobile-referral-cta/);
    expect(css).toMatch(/html\[data-vr-funnel-expanded\] #vr-nav a\[href="\/tools\/"\]/);
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]{0,400}#vr-nav \.vr-wordmark/);
    expect(css).toMatch(/#admin-btn\.hidden[\s\S]{0,60}display:\s*none\s*!important/);
    expect(css).toMatch(
      /html:not\(\[data-vr-funnel-expanded\]\):not\(\[data-vr-has-link\]\) \.vr-nav-links \.vr-lang-picker/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-funnel-expanded\]\):not\(\[data-vr-has-link\]\) \.vr-nav-links \.vr-nav-link/,
    );
    expect(css).toMatch(
      /html\[data-vr-direct-landing\]\[data-vr-funnel-expanded\]:not\(\[data-vr-has-link\]\) a\.vr-nav-link\[href="#prize"\]/,
    );
    expect(css).toMatch(/#hero-get-link-btn \.hero-cta-short/);
    expect(css).toMatch(/#hero-get-link-btn \.hero-cta-long/);
  });

  it('keeps compact Just entered / Rising / Challenger rungs on first paint', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain('id="site-drop-rungs"');
    expect(hero).toContain('Just entered');
    expect(hero).toContain('Rising');
    expect(hero).toContain('Challenger');
    expect(hero).toContain('drop.rung_open">open');
    expect(hero.indexOf('id="site-drop-rungs"')).toBeLessThan(hero.indexOf('id="hero-get-link-btn"'));
    expect(hero.indexOf('id="hero-banner-mock"')).toBeLessThan(hero.indexOf('id="site-drop-rungs"'));
    const banner = html.slice(
      html.indexOf('id="hero-banner-mock"'),
      html.indexOf('id="site-drop-rungs"'),
    );
    expect(banner).not.toContain('id="site-drop-rung-entered"');
    expect(html).toContain('Paste your site — 15 min');
    expect(html).toContain('data-i18n="drop.submit_short">Paste site');
    expect(html).toContain('placeholder="Paste yoursite.com"');
    const share = html.slice(html.indexOf('id="post-link-share"'), html.indexOf('id="referral-turnstile-container"'));
    expect(share).toContain('id="send-ladder-proof"');
    expect(share.indexOf('id="send-ladder-proof"')).toBeGreaterThan(share.indexOf('id="post-link-primary"'));
    expect(share).toContain('data-send-rung="entered"');
    expect(share).toContain('data-send-rung="rising"');
    expect(share).toContain('data-send-rung="challenger"');
  });

  it('keeps the wordmark readable at #f4f4f5', () => {
    const css = read('src/style.css');
    const html = read('index.html');
    expect(html).toContain('vr-wordmark');
    expect(css).toMatch(/#vr-nav \.vr-wordmark[\s\S]{0,80}color:\s*#f4f4f5/);
  });

  it('keeps the locked H1 accent readable, not transparent', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/\.hero-gradient #hero-title-accent[\s\S]{0,80}color:\s*#f4f4f5/);
    expect(css).not.toMatch(/\.hero-gradient #hero-title-accent[\s\S]{0,80}color:\s*transparent/);
  });

  it('does not CSS-hide How, Board, or footer', () => {
    const css = read('src/style.css');
    expect(css).not.toMatch(/#how\s*\{[^}]*display:\s*none/);
    expect(css).not.toMatch(/#leaderboard\s*\{[^}]*display:\s*none/);
    expect(css).not.toMatch(/footer\s*\{[^}]*display:\s*none/);
    expect(css).toContain(':not(#how):not(#leaderboard)');
    expect(css).toMatch(
      /html:not\(\[data-vr-funnel-expanded\]\):not\(\[data-vr-has-link\]\) \[data-vr-below-fold\]\[id="how"\]/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-funnel-expanded\]\):not\(\[data-vr-has-link\]\) \.vr-page-shell/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-funnel-expanded\]\):not\(\[data-vr-has-link\]\) #funnel-expand-wrap/,
    );
    const html = read('index.html');
    expect(html).toContain('id="site-drops"');
    expect(html).toMatch(/id="site-drops"[^>]*data-vr-below-fold/);
    expect(html).toMatch(/href="#how"[^>]*data-i18n="nav.how"/);
    expect(html).toMatch(/href="#leaderboard"[^>]*data-i18n="nav.board"/);
    expect(html).not.toMatch(/href="#how"[^>]*hidden sm:inline/);
    expect(html).toContain('<footer');
    expect(html).toContain('id="site-footer"');
    expect(html).toContain('id="footer-link-tools"');
    expect(html).toContain('href="/tools/"');
    expect(html).toContain('/tools/utm-builder.html');
    expect(html).toContain('utm_source=leadmagnet');
    expect(html).toContain('href="/guides/');
    expect(html).toContain('id="footer-link-guides"');
    expect(html).toContain('/guides/site-drops/');
    expect(html).toContain('/tools/share-generator.html');
    expect(html).toContain('/tools/utm-builder.html');
    expect(html).toContain('/tools/credit-checker.html');
    expect(html).toContain('id="footer-tools-row"');
    expect(html).toContain('id="footer-link-telegram-helper"');
    expect(html).not.toMatch(/href="\/tools\/"[^>]*hidden sm:inline/);
    expect(css).not.toMatch(/#site-footer\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(
      /html\[data-vr-direct-landing\]:not\(\[data-vr-has-link\]\) \.vr-nav-link:not\(\[href="#how"\]\):not\(\[href="#leaderboard"\]\)/,
    );
  });

  it('uses Recent Activity as the large board title, not Early Leaderboard', () => {
    const html = read('index.html');
    const i18n = read('src/lib/i18n/messages.ts');
    const content = read('src/content.ts');
    expect(html).toMatch(
      /id="leaderboard-title"[^>]*>\s*Recent Activity\s*<\/h2>/,
    );
    expect(html).toContain('data-i18n="leaderboard.title"');
    const board = html.slice(html.indexOf('id="leaderboard-title"'), html.indexOf('id="leaderboard-container"'));
    expect(board).not.toContain('Early Leaderboard');
    expect(i18n).toContain("'leaderboard.title': 'Recent Activity'");
    expect(i18n).not.toContain("'leaderboard.title': 'Live Leaderboard'");
    expect(i18n).not.toContain("'leaderboard.title': 'Early Leaderboard'");
    expect(content).not.toContain("apply('leaderboard-title', 'leaderboard_title')");
    const lock = read('src/lib/hero-cta-variant.ts');
    expect(lock).toContain("boardTitle.textContent = 'Recent Activity'");
    expect(lock).toContain('Early Leaderboard');
    expect(html).toContain('data-i18n="drop.badge">Site Drop ladder</p>');
    expect(html).toContain('Your site here');
    expect(html).toContain('id="footer-link-tools"');
  });

  it('keeps Copy above overlays', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/#post-link-copy/);
    expect(css).toMatch(/pointer-events:\s*auto\s*!important/);
    expect(css).toMatch(/#vr-exit-rescue[\s\S]{0,120}pointer-events:\s*none/);
  });

  it('does not let share-abandon cover owner HQ Command', () => {
    const css = read('src/style.css');
    const html = read('index.html');
    expect(css).toMatch(/html\[data-vr-owner-hq\] \.vr-share-abandon/);
    expect(css).toMatch(/html:has\(#admin-modal:not\(\.hidden\)\) \.vr-share-abandon/);
    expect(css).toMatch(/html:has\(#admin-owner-gate-modal:not\(\.hidden\)\) \.vr-share-abandon/);
    expect(css).toMatch(/pointer-events:\s*none\s*!important/);
    expect(css).toMatch(/visibility:\s*hidden\s*!important/);
    expect(css).toMatch(/#admin-modal[\s\S]{0,80}z-index:\s*980/);
    expect(html).toContain('z-[980]');
    expect(html).toContain('hq-command');
    expect(html).toContain('HQ Command');
    expect(css).toMatch(/\.hq-order/);
    expect(css).toMatch(/\.hq-loop/);
    expect(css).toMatch(/\.hq-feed-filter/);
    expect(css).toMatch(/\.hq-order-evidence/);
    expect(css).toMatch(/\.hq-guard/);
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).not.toContain('HQ Command');
    expect(hero).toContain(LOCKED_SITE_DROPS_CTA);
  });

  it('registers one register-referrer-link per Get my link', () => {
    const referral = read('src/referral.ts');
    const deadline = read('src/lib/share-deadline.ts');
    expect((referral.match(/registerReferrerLinkDeadline\(/g) || []).length).toBe(1);
    expect(deadline).toContain('registerReferrerLinkInFlight');
    expect(deadline).toContain("functions.invoke('register-referrer-link'");
  });

  it('keeps required public files', () => {
    expect(existsSync(resolve(root, 'public/google163d31ba24216edd.html'))).toBe(true);
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
    expect(existsSync(resolve(root, 'public/llms.txt'))).toBe(true);
    expect(existsSync(resolve(root, 'public/llms-full.txt'))).toBe(true);
    expect(existsSync(resolve(root, 'src/lib/site-drops.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'src/admin/owner-funnel-desk.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'supabase/functions/_shared/owner-funnel-gsc.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'public/tools'))).toBe(true);
    expect(read('src/admin/owner-funnel-desk.ts')).toMatch(/data-owner-desk-gsc/);
    expect(read('index.html')).toMatch(/data-owner-desk-gsc/);
    expect(read('supabase/functions/admin-action/index.ts')).toMatch(/resolveOwnerFunnelGsc/);
    expect(read('supabase/functions/admin-action/index.ts')).toContain(
      "Deno.env.get('GSC_SERVICE_ACCOUNT_JSON')",
    );
    expect(read('supabase/functions/admin-action/index.ts')).toContain("Deno.env.get('GSC_SITE_URL')");
    expect(read('supabase/functions/admin-action/index.ts')).not.toMatch(/GSC_API_KEY/);
    expect(read('supabase/functions/_shared/owner-funnel-gsc.ts')).toContain(
      "readEnv('GSC_SERVICE_ACCOUNT_JSON')",
    );
    expect(read('supabase/functions/_shared/owner-funnel-gsc.ts')).toContain("readEnv('GSC_SITE_URL')");
    expect(read('supabase/functions/_shared/owner-funnel-gsc.ts')).not.toMatch(/GSC_API_KEY/);
    expect(read('supabase/functions/_shared/owner-funnel-gsc.ts')).not.toMatch(/VITE_GSC/);
    expect(read('src/lib/turnstile.ts')).toContain("size: 'compact'");
    expect(read('src/lib/turnstile.ts')).not.toMatch(/size:\s*['"]invisible['"]/);
    expect(read('src/lib/turnstile.ts')).toContain('prefetchCreditTurnstileToken');
    expect(read('index.html')).toContain('id="friend-credit-turnstile"');
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-referred-landing\]:not\(\[data-vr-has-link\]\) \.friend-credit-turnstile/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #hero-prize-one/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #hero-subtitle/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\]:not\(\[data-vr-credit-status='pending'\]\):not\(\[data-vr-credit-status='failed'\]\) \.friend-credit-turnstile/,
    );
    expect(read('src/style.css')).toContain('post-link-site-drop__jump');
    expect(read('index.html')).toContain('post-link-site-drop__jump');
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-post-link-one\] #post-link-url/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-post-link-one\] #post-link-tool/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-post-link-one\] #share-deadline-banner/,
    );
    expect(read('src/lib/site-drops-ui.ts')).toContain('prefetchSiteDropToken');
    expect(read('src/lib/site-drops-ui.ts')).toContain('prefetchSiteDropScript');
    expect(read('src/lib/site-drops-ui.ts')).toMatch(
      /function prefetchSiteDropToken\(\)[\s\S]{0,320}normalizeWebsiteUrl\(readFormWebsite\(\)\)\) return/,
    );
    expect(read('src/lib/site-drops-ui.ts')).toContain('armSiteDropChallenge');
    expect(read('src/lib/site-drops-ui.ts')).toContain("appearance: 'always'");
    expect(read('src/lib/post-link-share.ts')).toContain('restoreFunnelStep');
    expect(read('src/lib/post-link-share.ts')).toContain('persistFunnelStep');
    expect(read('index.html')).toContain('rel="preconnect" href="https://challenges.cloudflare.com"');
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-send\]:not\(\[data-vr-did-paste\]\) #post-link-site-drop-turnstile/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #friend-credit-turnstile/,
    );
    expect(read('src/lib/site-drops-ui.ts')).toMatch(
      /export function revealSiteDropForm[\s\S]{0,900}prefetchSiteDropScript\(\)/,
    );
    expect(read('src/lib/post-link-share.ts')).toContain('prefetchSiteDropScript');
    expect(read('src/lib/post-link-share.ts')).toContain('pointerdown');
    expect(read('src/lib/post-link-share.ts')).not.toContain('scrollIntoView');
    expect(read('src/referral.ts')).not.toMatch(/getElementById\('qr-code'\)/);
    expect(read('src/lib/site-drops-ui.ts')).toContain("const DROP_BUSY_LABEL = 'Saving…'");
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\]:not\(\[data-vr-did-send\]\) #post-link-site-drop/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\]:not\(\[data-vr-did-paste\]\) #site-entered-ticker/,
    );
    expect(read('src/style.css')).toContain(".post-link-site-drop__submit[aria-busy='true']");
    expect(read('src/style.css')).toContain('#post-link-site-drop-turnstile:not(:has(iframe))');
    expect(read('src/lib/site-drops-ui.ts')).toContain(
      'Send it — a friend tapping Get my link is the climb.',
    );
    expect(read('src/lib/site-drops-ui.ts')).toMatch(
      /data-vr-did-paste[\s\S]{0,520}post-link-primary/,
    );
    expect(read('src/lib/share-abandon-rescue.ts')).toContain("getElementById('post-link-primary')");
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-post-link-one\] #share-confirm-banner/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\] #referral-attribution/,
    );
    expect(read('src/lib/post-link-share.ts')).toContain('focusSendReady');
    expect(read('src/referral.ts')).not.toContain('maybeOfferSameGestureShare');
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #post-link-heading/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #post-link-sub/);
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\] #post-link-share\[data-state='loading'\] #post-link-site-drop/,
    );
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] \.vr-nav-link/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #post-link-site-drop-jump/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #post-link-copy/);
    expect(read('src/lib/post-link-share.ts')).toContain("data-vr-did-send");
    expect(read('src/lib/post-link-share.ts')).toContain('armPasteAfterSend');
    expect(read('src/lib/post-link-share.ts')).not.toContain(', 700)');
    expect(read('src/lib/post-link-share.ts')).toContain('saveSiteDropIfUrlReady');
    expect(read('src/style.css')).toMatch(
      /html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #hero-title-accent/,
    );
    expect(read('src/style.css')).toMatch(
      /html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #hero-prize-one/,
    );
    expect(read('src/style.css')).toMatch(
      /#hero-prize-one,\s*html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #hero-banner-mock,\s*html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #funnel-expand-wrap/,
    );
    expect(read('index.html').indexOf('id="site-footer"')).toBeLessThan(
      read('index.html').indexOf('id="friend-credit-turnstile"'),
    );
    expect(read('src/style.css')).toContain('#friend-credit-turnstile:not(:has(iframe))');
    expect(read('src/style.css')).toContain('html[data-vr-did-send] .post-link-site-drop__submit');
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] \.vr-hero-panel/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #vr-funnel-ticker/);
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\] \.vr-page-shell[\s\S]{0,220}padding-top:\s*3\.25rem/,
    );
    expect(read('src/style.css')).toContain('padding-top: 3.4rem !important');
    const shareHtml = read('index.html').slice(
      read('index.html').indexOf('id="post-link-share"'),
      read('index.html').indexOf('id="referral-turnstile-container"'),
    );
    expect(shareHtml.indexOf('id="post-link-primary"')).toBeGreaterThan(-1);
    expect(shareHtml.indexOf('id="post-link-site-drop"')).toBeGreaterThan(
      shareHtml.indexOf('id="post-link-primary"'),
    );
    expect(shareHtml.indexOf('id="post-link-site-drop-turnstile"')).toBeGreaterThan(
      shareHtml.indexOf('id="post-link-site-drop-submit"'),
    );
    expect(shareHtml.indexOf('id="site-entered-ticker"')).toBeGreaterThan(
      shareHtml.indexOf('id="post-link-site-drop"'),
    );
    expect(shareHtml.indexOf('id="post-link-copy"')).toBeGreaterThan(
      shareHtml.indexOf('id="site-entered-ticker"'),
    );
    expect(read('src/lib/site-drops-ui.ts')).toContain('keydown');
    expect(read('src/lib/site-drops-ui.ts')).toContain('data-vr-did-paste');
    expect(read('src/lib/site-drops-ui.ts')).toContain('paintOwnSiteDropChip');
    expect(read('src/lib/site-drops-ui.ts')).toContain('site-entered-ticker__empty');
    expect(read('src/style.css')).toContain('html[data-vr-did-paste] .post-link-site-drop__submit');
    expect(read('src/style.css')).toContain('html:not([data-vr-did-paste]) #send-ladder-proof');
    expect(read('src/style.css')).toContain('html[data-vr-did-paste] #send-ladder-proof');
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-paste\] #site-entered-ticker/,
    );
    expect(read('src/style.css')).toContain('#site-drop-status:empty');
    expect(read('src/style.css')).toContain('#site-entered-chips:empty');
    expect(read('src/style.css')).toMatch(/html\[data-vr-did-paste\] #post-link-site-drop \{/);
    expect(read('src/lib/site-drops-ui.ts')).toContain('data-send-rung');
    expect(read('src/lib/site-drops-ui.ts')).toContain('vrFromPaste');
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-send\]:not\(\[data-vr-did-paste\]\) #post-link-site-drop/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-send\]:not\(\[data-vr-did-paste\]\) \.post-link-site-drop__title/,
    );
    expect(read('src/style.css')).toMatch(/html\[data-vr-did-send\] \.drop-submit-short/);
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-has-link\] \.post-link-site-drop[\s\S]{0,180}width:\s*100%/,
    );
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-send\]:not\(\[data-vr-did-paste\]\) #post-link-primary/,
    );
    expect(read('src/style.css')).toMatch(/html\[data-vr-did-paste\] #post-link-primary/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-did-send\] \.vr-share-abandon/);
    expect(read('src/style.css')).toMatch(/html\[data-vr-has-link\] #site-entered-chips/);
    expect(read('src/style.css')).toMatch(
      /html\[data-vr-did-send\]:not\(\[data-vr-did-paste\]\) #site-entered-ticker/,
    );
    expect(read('src/style.css')).toMatch(
      /#post-link-share:not\(\.hidden\)[\s\S]{0,80}display:\s*flex/,
    );
    expect(read('src/style.css')).toMatch(
      /\.post-link-site-drop__submit[\s\S]{0,360}linear-gradient\(90deg, #6d28d9/,
    );
    expect(read('src/style.css')).not.toMatch(
      /html\[data-vr-has-link\] \.post-link-site-drop__title,\s*html\[data-vr-post-link-one\] \.post-link-site-drop__title,/,
    );
    expect(read('index.html')).toMatch(/id="post-link-site-drop-url"[^>]*type="text"/);
    expect(read('index.html')).toMatch(/id="post-link-site-drop-url"[^>]*aria-label="Your website"/);
    expect(read('supabase/functions/_shared/record-referral-handler.ts')).toContain(
      'tryClimbSiteDrop',
    );
    expect(read('src/lib/site-drops-ui.ts')).toContain('submitInFlight');
    expect(read('vercel.json')).toContain('https://*.challenges.cloudflare.com');
    expect(read('src/public/modals.ts')).toMatch(/z-\[990\]/);
    expect(read('src/public/modals.ts')).toMatch(/dismissShareAbandonOverlay\(\)/);
    expect(read('src/public/modals.ts')).toContain('verifyOwnerPassword');
    expect(read('src/public/modals.ts')).not.toMatch(/functions\.invoke/);
  });
});
