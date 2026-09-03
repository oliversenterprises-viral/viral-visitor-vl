import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('engineering 9 locks', () => {
  it('Edge junk-traffic is a re-export of src/lib/junk-traffic.ts', () => {
    const edge = read('supabase/functions/_shared/junk-traffic.ts');
    expect(edge).toMatch(/from '\.\.\/\.\.\/\.\.\/src\/lib\/junk-traffic\.ts'/);
    expect(edge).toContain('shouldSkipServerLandingWrite');
    expect(edge).toContain('shouldIncrementQualityLandingVisit');
    expect(edge).toContain('isJunkUtmEvent');
    expect(edge).toContain('shouldDeleteJunkUtmVisitorEvent');
    expect(edge).not.toMatch(/const JUNK_SOURCES/);
  });

  it('deploy:prod applies pending SQL and requires Playwright Chromium', () => {
    const deploy = read('scripts/deploy-prod.mjs');
    expect(deploy).toContain('apply-pending-prod-migrations.mjs');
    expect(deploy).toContain('playwright install chromium');
    expect(deploy.indexOf('apply-pending-prod-migrations')).toBeLessThan(
      deploy.indexOf('functions deploy'),
    );
    expect(deploy.lastIndexOf('playwright install chromium')).toBeLessThan(
      deploy.lastIndexOf("npm run test:smoke:prod"),
    );
  });

  it('live smoke treats a missing Playwright browser as a failure', () => {
    const smoke = read('scripts/smoke-prod-referrals.mjs');
    expect(smoke).not.toContain('Skipped — run npx playwright install');
    expect(smoke).toContain('Playwright browser missing');
    const failAt = smoke.indexOf('Playwright browser missing');
    const warnAfter = smoke.slice(failAt, failAt + 180);
    expect(warnAfter).not.toMatch(/'warn'/);
  });

  it('has-link may hide the Get-link button but must keep the prize slot visible', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/html\[data-vr-has-link\] #hero-get-link-btn/);
    const keepAt = css.indexOf('Keep the prize slot visible after Get my link');
    expect(keepAt).toBeGreaterThan(0);
    expect(css.slice(keepAt, keepAt + 400)).toMatch(/#hero-banner-mock/);
    expect(css.slice(keepAt, keepAt + 400)).toMatch(/display: block !important/);
    const hideBlock = css.slice(
      css.indexOf('/* After Get my link: the only job is send */'),
      css.indexOf('/* Keep the prize slot visible after Get my link'),
    );
    expect(hideBlock).not.toMatch(/#hero-banner-mock/);
  });
});
