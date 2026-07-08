/**
 * Admin-driven funnel coach + step labels (site_content keys).
 */

import { normalizeSiteContentText } from './site-content-value';

const CMS_KEYS = [
  'funnel_journey_badge',
  'funnel_step1_label',
  'funnel_step2_label',
  'funnel_step3_label',
  'funnel_guide_step1',
  'funnel_guide_step2',
  'funnel_guide_step3',
  'funnel_guide_complete',
  'funnel_credit_gate_title',
  'funnel_credit_gate_desc',
  'hero_trust_line',
] as const;

type FunnelCopyKey = (typeof CMS_KEYS)[number];

let copyCache: Partial<Record<FunnelCopyKey, string>> = {};

export function initFunnelCopyFromContent(content: Record<string, unknown>): void {
  copyCache = {};
  for (const key of CMS_KEYS) {
    const text = normalizeSiteContentText(content[key]);
    if (text != null) copyCache[key] = text;
  }
}

export function getFunnelCopy(key: FunnelCopyKey): string | null {
  return copyCache[key] ?? null;
}

export function clearFunnelCopyCache(): void {
  copyCache = {};
}