import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('site-drops five live defects (behavior only)', () => {
  it('exit overlays do not schedule dwell, poll, or return auto-show', () => {
    const abandon = read('src/lib/share-abandon-rescue.ts');
    const exitRescue = read('src/lib/exit-intent-rescue.ts');
    expect(abandon).toContain("tryShow('exit'");
    expect(abandon).not.toContain("tryShow('dwell'");
    expect(abandon).not.toContain("tryShow('poll'");
    expect(abandon).not.toContain("tryShow('return'");
    expect(abandon).not.toMatch(/setInterval\(\s*\(\)\s*=>\s*\{/);
    expect(exitRescue).toContain("tryShow('exit')");
    expect(exitRescue).not.toContain("tryShow('dwell')");
    expect(exitRescue).not.toMatch(/setTimeout\(\(\)\s*=>\s*tryShow\('dwell'\)/);
  });

  it('public homepage paints #how, #prize, #leaderboard, and footer; embed/referred-micro stay hidden', () => {
    const css = read('src/style.css');
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) #how/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) #prize/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) #leaderboard/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) footer/,
    );
    expect(css).toMatch(/html\[data-vr-embed\] \[data-vr-below-fold\]/);
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #how/,
    );
    expect(css).not.toMatch(/html:not\(\[data-vr-has-link\]\) #prize \{\s*display: none/);
  });

  it('header wordmark is forced light on the dark nav', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/#vr-nav \.logo-font\s*\{\s*color:\s*#f4f4f5/);
    expect(read('index.html')).toContain('>ViralRefer</span>');
  });

  it('admin-action implements get_site_content and update_site_content', () => {
    const src = read('supabase/functions/admin-action/index.ts');
    expect(src).toMatch(/action === 'get_site_content'/);
    expect(src).toMatch(/action === 'update_site_content'/);
    expect(src.indexOf("action === 'get_site_content'")).toBeLessThan(
      src.indexOf("action === 'update_site_content'"),
    );
  });
});

const invokeMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
  isSupabaseConfigured: true,
}));

describe('register-referrer-link one POST per Get my link tap', () => {
  beforeEach(async () => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          status: 'pending_share',
          created_at: '2026-09-02T00:00:00.000Z',
          deadline_at: '2026-09-04T00:00:00.000Z',
        },
      },
      error: null,
    });
    const { resetRegisterReferrerLinkDeadlineForTest } = await import(
      '../../src/lib/share-deadline'
    );
    resetRegisterReferrerLinkDeadlineForTest();
  });

  it('four burst callers share a single invoke', async () => {
    const { registerReferrerLinkDeadline } = await import('../../src/lib/share-deadline');
    await Promise.all([
      registerReferrerLinkDeadline('VIRAL-TAP01'),
      registerReferrerLinkDeadline('VIRAL-TAP01'),
      registerReferrerLinkDeadline('VIRAL-TAP01'),
      registerReferrerLinkDeadline('VIRAL-TAP01'),
    ]);
    const posts = invokeMock.mock.calls.filter(
      (c) => c[0] === 'register-referrer-link',
    );
    expect(posts).toHaveLength(1);
  });
});
