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
    expect((hero.match(/id="hero-get-link-btn"/g) || []).length).toBe(1);
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
    expect(read('vercel.json')).toContain('https://*.challenges.cloudflare.com');
    expect(read('src/public/modals.ts')).toMatch(/z-\[990\]/);
    expect(read('src/public/modals.ts')).toMatch(/dismissShareAbandonOverlay\(\)/);
    expect(read('src/public/modals.ts')).toContain('verifyOwnerPassword');
    expect(read('src/public/modals.ts')).not.toMatch(/functions\.invoke/);
  });
});
