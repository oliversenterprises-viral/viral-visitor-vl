import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/lib/i18n/messages';
import {
  LOCKED_LIVE_FAQ_A3,
  LOCKED_LIVE_FAQ_PRIZE,
  LOCKED_LIVE_HOW_BADGE,
  LOCKED_LIVE_HOW_STEP1_DESC,
  LOCKED_LIVE_HOW_STEP2_DESC,
  LOCKED_LIVE_HOW_STEP2_TITLE,
  LOCKED_LIVE_HOW_STEP3,
  LOCKED_LIVE_HOW_STEP3_TITLE,
  LOCKED_LIVE_HOW_SUBTITLE,
  LOCKED_LIVE_PRIZE_CTA,
  LOCKED_LIVE_PRIZE_SUB,
  LOCKED_LIVE_PRIZE_TITLE,
  LOCKED_SITE_DROPS_CTA,
  LOCKED_SITE_DROPS_H1_ACCENT,
  LOCKED_SITE_DROPS_H1_LINE1,
  LOCKED_SITE_DROPS_RULE,
  LOCKED_SITE_DROPS_SLOT,
  LOCKED_SITE_DROPS_SUB,
  LOCKED_SITE_DROPS_TITLE,
} from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

const MUST_KEEP: Array<{ path: string; minBytes: number; contains?: string }> = [
  {
    path: 'public/google163d31ba24216edd.html',
    minBytes: 40,
    contains: 'google-site-verification: google163d31ba24216edd.html',
  },
  { path: 'public/llms.txt', minBytes: 200, contains: 'https://www.viralrefer.app' },
  { path: 'public/llms-full.txt', minBytes: 500, contains: 'viralrefer.app' },
  { path: 'public/guides/site-drops/index.html', minBytes: 500, contains: 'Site Drop' },
  { path: 'public/tools/credit-checker.html', minBytes: 500, contains: 'Get my referral link' },
  { path: 'src/lib/site-drops.ts', minBytes: 100, contains: 'SITE_DROPS_KEY' },
  { path: 'src/admin/owner-funnel-desk.ts', minBytes: 500, contains: 'renderOwnerFunnelDesk' },
];

function failMissingOrEmpty(rel: string, minBytes: number): string {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    throw new Error(`MUST-KEEP missing: ${rel}`);
  }
  const st = statSync(abs);
  if (!st.isFile()) {
    throw new Error(`MUST-KEEP emptied or not a file: ${rel}`);
  }
  if (st.size < minBytes) {
    throw new Error(`MUST-KEEP emptied: ${rel} is ${st.size} bytes (need ≥ ${minBytes})`);
  }
  return readFileSync(abs, 'utf8');
}

describe('must-keep files', () => {
  it('fails if any required file is missing or emptied', () => {
    expect(existsSync(resolve(root, 'public/guides/site-drops'))).toBe(true);
    expect(statSync(resolve(root, 'public/guides/site-drops')).isDirectory()).toBe(true);

    for (const item of MUST_KEEP) {
      const body = failMissingOrEmpty(item.path, item.minBytes);
      expect(body.trim().length).toBeGreaterThan(0);
      if (item.contains) expect(body).toContain(item.contains);
    }
  });

  it('keeps locked Site Drops strings exact in index.html and English i18n', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_LINE1);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_ACCENT);
    expect(html).toContain(LOCKED_SITE_DROPS_SUB);
    expect(html).toContain(LOCKED_SITE_DROPS_SLOT);
    expect(html).toContain(LOCKED_SITE_DROPS_RULE);
    expect(html).toContain(LOCKED_SITE_DROPS_CTA);

    expect(en['hero.title_line1']).toBe(LOCKED_SITE_DROPS_H1_LINE1);
    expect(en['hero.title_accent']).toBe(LOCKED_SITE_DROPS_H1_ACCENT);
    expect(en['hero.subtitle']).toBe(LOCKED_SITE_DROPS_SUB);
    expect(en['hero.prize_one']).toBe(LOCKED_SITE_DROPS_RULE);
    expect(en['hero.cta']).toBe(LOCKED_SITE_DROPS_CTA);
  });

  it('does not drift from live 7-day / 3-friend Site Drops copy', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html.toLowerCase()).not.toContain('30-day');
    expect(html).not.toContain('at least 10 friends');
    expect(html).toContain(LOCKED_LIVE_FAQ_PRIZE);
    expect(html).toContain(LOCKED_LIVE_FAQ_A3);
    expect(html).toContain(LOCKED_LIVE_HOW_BADGE);
    expect(html).not.toMatch(/id="how-it-works-badge"[^>]*>3 EASY STEPS/);
    expect(html).toContain(LOCKED_LIVE_HOW_SUBTITLE);
    expect(html).toContain(LOCKED_LIVE_HOW_STEP1_DESC);
    expect(html).toContain(LOCKED_LIVE_HOW_STEP2_TITLE);
    expect(html).toContain(LOCKED_LIVE_HOW_STEP2_DESC);
    expect(html).toContain(LOCKED_LIVE_HOW_STEP3);
    expect(html).toContain(LOCKED_LIVE_HOW_STEP3_TITLE);
    expect(html).toContain(LOCKED_LIVE_PRIZE_SUB);
    expect(html).toContain(LOCKED_LIVE_PRIZE_TITLE);
    expect(html).toContain(LOCKED_LIVE_PRIZE_CTA);
    expect(html).toContain('7-day homepage slot');
    expect(html).toContain('id="min-referrals-value">3<');

    expect(en['how.badge']).toBe(LOCKED_LIVE_HOW_BADGE);
    expect(en['how.subtitle']).toBe(LOCKED_LIVE_HOW_SUBTITLE);
    expect(en['how.step1_desc']).toBe(LOCKED_LIVE_HOW_STEP1_DESC);
    expect(en['how.step2_title']).toBe(LOCKED_LIVE_HOW_STEP2_TITLE);
    expect(en['how.step2_desc']).toBe(LOCKED_LIVE_HOW_STEP2_DESC);
    expect(en['how.step3_title']).toBe(LOCKED_LIVE_HOW_STEP3_TITLE);
    expect(en['how.step3_desc']).toBe(LOCKED_LIVE_HOW_STEP3);
    expect(en['prize.subtitle']).toBe(LOCKED_LIVE_PRIZE_SUB);
    expect(en['prize.title']).toBe(LOCKED_LIVE_PRIZE_TITLE);
    expect(en['prize.cta']).toBe(LOCKED_LIVE_PRIZE_CTA);
    expect(en['hero.trust']).not.toMatch(/30-day/i);
    expect(html).toContain('id="site-drops"');
    expect(html).toContain('id="site-drops-entered-list"');
    expect(html).toContain('id="site-drops-rising-list"');
    expect(html).toContain('id="site-drops-challenger-list"');
    expect(html).toContain('id="site-drop-form"');
    expect(html).toContain('id="post-link-site-drop-jump"');
    expect(en['drop.lead']).toMatch(/7-day banner/);
    expect(en['drop.lead']).not.toMatch(/30-day/i);
  });

  it('does not add reset_landing_visit_counters, cash-prize claims, or a VITE_ owner password', () => {
    const adminFn = readFileSync(resolve(root, 'supabase/functions/admin-action/index.ts'), 'utf8');
    const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
    const website = readFileSync(resolve(root, 'src/admin/edit-content-tab.ts'), 'utf8');
    expect(adminFn).not.toContain('reset_landing_visit_counters');
    expect(website).not.toContain('reset_landing_visit_counters');
    expect(envExample).not.toMatch(/^VITE_ADMIN_PASSWORD=/m);
    expect(envExample).not.toMatch(/^VITE_ADMIN_OWNER_PASSWORD=/m);
    expect(envExample).toContain('ADMIN_OWNER_PASSWORD');
    expect(envExample).toContain('(no VITE_ADMIN_PASSWORD)');

    const srcFiles = [
      'src/lib/supabase.ts',
      'src/lib/admin-action-client.ts',
      'src/admin/edit-content-tab.ts',
      'vite.config.ts',
    ];
    for (const rel of srcFiles) {
      const src = readFileSync(resolve(root, rel), 'utf8');
      expect(src).not.toMatch(/import\.meta\.env\.VITE_ADMIN_(OWNER_)?PASSWORD/);
      expect(src).not.toContain('reset_landing_visit_counters');
    }
  });
});
