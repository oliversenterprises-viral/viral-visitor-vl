import { describe, it, expect } from 'vitest';
import {
  funnelArrowState,
  funnelGuideIconClass,
  getFunnelGuideCopy,
  getFunnelShareCompleteCopy,
  resolveFunnelGuideTargetId,
} from '../../src/lib/funnel-guide-helpers';

describe('funnel-guide-helpers', () => {
  it('resolveFunnelGuideTargetId picks attribution CTA when banner visible', () => {
    expect(resolveFunnelGuideTargetId(1, { attributionBannerVisible: true })).toBe(
      'attribution-get-link-btn',
    );
    expect(resolveFunnelGuideTargetId(1)).toBe('hero-get-link-btn');
    expect(resolveFunnelGuideTargetId(2)).toBe('copy-link-btn');
    expect(resolveFunnelGuideTargetId(3)).toBe('share-whatsapp-primary');
  });

  it('funnelArrowState flows on active step boundary', () => {
    expect(funnelArrowState(1, 1)).toBe('flow');
    expect(funnelArrowState(1, 2)).toBe('done');
    expect(funnelArrowState(2, 2)).toBe('flow');
    expect(funnelArrowState(2, 1)).toBe('idle');
  });

  it('getFunnelGuideCopy returns step-specific coach text', () => {
    expect(getFunnelGuideCopy(1).message).toMatch(/Step 1/i);
    expect(getFunnelGuideCopy(2).message).toMatch(/COPY/i);
    expect(getFunnelGuideCopy(3).message).toMatch(/WhatsApp/i);
    expect(getFunnelShareCompleteCopy().icon).toBe('check');
  });

  it('funnelGuideIconClass maps icon names', () => {
    expect(funnelGuideIconClass('up')).toBe('fa-arrow-up');
    expect(funnelGuideIconClass('check')).toBe('fa-circle-check');
  });
});