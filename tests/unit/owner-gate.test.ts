import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('owner gate', () => {
  it('paints a solid owner-key card above the homepage', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/#admin-owner-gate-modal \{/);
    expect(css).toMatch(/#admin-owner-gate-modal \[data-vr-owner-gate-panel\]/);
    expect(css).toMatch(/background: #18181b !important/);
    expect(css).toContain('z-index: 10050 !important');
  });

  it('keeps the owner gate in JS, not first-paint HTML', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const ts = readFileSync(resolve(ROOT, 'src/public/modals.ts'), 'utf8');
    expect(html).not.toContain('id="admin-owner-gate-modal"');
    expect(ts).toContain('ensureAdminOwnerGateModal');
    expect(ts).toContain('Owner key');
  });

  it('keeps Featured Partner splash and thanks on this tree', () => {
    const sponsor = readFileSync(resolve(ROOT, 'public/go/sponsor/index.html'), 'utf8');
    const thanks = readFileSync(resolve(ROOT, 'public/go/sponsor/thanks/index.html'), 'utf8');
    const hub = readFileSync(resolve(ROOT, 'public/go/index.html'), 'utf8');
    expect(sponsor).toMatch(/Featured Partner/i);
    expect(sponsor).toMatch(/no cash prize/i);
    expect(thanks).toMatch(/not a Site Drop/i);
    expect(hub).toContain('/go/sponsor/');
  });
});
