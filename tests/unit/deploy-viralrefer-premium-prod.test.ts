import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LIVE_ORIGIN,
  VERCEL_PROJECT_NAME,
  isLiveOrigin,
  requireVercelProdToken,
  writeVercelProjectLink,
} from '../../scripts/deploy-viralrefer-premium-prod.mjs';

describe('deploy-viralrefer-premium-prod', () => {
  it('fails closed when VERCEL_TOKEN is missing or blank', () => {
    expect(() => requireVercelProdToken({})).toThrow(/VERCEL_TOKEN is missing/);
    expect(() => requireVercelProdToken({ VERCEL_TOKEN: '   ' })).toThrow(/Preview is not live/);
    expect(requireVercelProdToken({ VERCEL_TOKEN: 'vr_test_token' })).toBe('vr_test_token');
  });

  it('treats only www.viralrefer.app as live', () => {
    expect(isLiveOrigin(LIVE_ORIGIN)).toBe(true);
    expect(isLiveOrigin(`${LIVE_ORIGIN}/version.json`)).toBe(true);
    expect(isLiveOrigin('https://viralrefer-premium.vercel.app')).toBe(false);
    expect(isLiveOrigin('https://viral-visitor-vl-git-cursor-site-drops-hq-first-screen-14ec.vercel.app')).toBe(
      false,
    );
    expect(VERCEL_PROJECT_NAME).toBe('viralrefer-premium');
  });

  it('writes the viralrefer-premium project link', () => {
    const root = mkdtempSync(join(tmpdir(), 'vr-vercel-'));
    writeVercelProjectLink(root);
    const linked = JSON.parse(readFileSync(join(root, '.vercel', 'project.json'), 'utf8'));
    expect(linked.projectName).toBe('viralrefer-premium');
    expect(linked.projectId).toBe('prj_lEguzmle2JOlyRyzO0zHjG2HtpNv');
  });
});
