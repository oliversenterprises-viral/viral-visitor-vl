import { describe, expect, it, beforeEach } from 'vitest';
import { initFunnelCopyFromContent, getFunnelCopy, clearFunnelCopyCache } from '../../src/lib/funnel-copy';
import { getFunnelGuideCopy } from '../../src/lib/funnel-guide-helpers';

describe('funnel-copy CMS overrides', () => {
  beforeEach(() => {
    clearFunnelCopyCache();
  });

  it('loads admin copy from site_content', () => {
    initFunnelCopyFromContent({
      funnel_guide_step1: 'Custom step 1 coach',
      funnel_step2_label: '2. Copy link',
    });
    expect(getFunnelCopy('funnel_guide_step1')).toBe('Custom step 1 coach');
    expect(getFunnelCopy('funnel_step2_label')).toBe('2. Copy link');
  });

  it('getFunnelGuideCopy prefers CMS override', () => {
    initFunnelCopyFromContent({ funnel_guide_step2: 'Admin says: hit COPY now' });
    expect(getFunnelGuideCopy(2).message).toBe('Admin says: hit COPY now');
  });
});