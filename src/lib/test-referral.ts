/** Client filters — shared logic with record-referral edge + SQL RPCs. */

import { isAutomationUserAgent as detectAutomationUserAgent } from '../../supabase/functions/_shared/test-referral';

export {
  isAgentAutomationMetadata,
  isAutomationUserAgent,
  isGrokBuildHit,
  isGrokBuildMetadata,
  isGrokBuildUserAgent,
  isOwnerReferralIp,
  isTestReferralRecord,
  isTestReferrerCode,
  shouldSkipReferralCrediting,
} from '../../supabase/functions/_shared/test-referral';

function isGrokBuildClient(): boolean {
  try {
    const w = window as unknown as { __GROK_BUILD__?: unknown };
    if (w.__GROK_BUILD__) return true;
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  } catch {
    /* ignore */
  }
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/grok[\s_-]?build|\bgrok\b|NovaVerify|HeadlessChrome/i.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Stamp Playwright/Grok Build browsers so HQ can drop them. */
export function getClientAutomationMetadata(): Record<string, unknown> {
  try {
    if (typeof navigator === 'undefined') return {};
    const out: Record<string, unknown> = {};
    if (navigator.webdriver) out.webdriver = true;
    const ua = navigator.userAgent || '';
    if (detectAutomationUserAgent(ua)) out.automation = true;
    if (isGrokBuildClient()) out.grok_build = true;
    return out;
  } catch {
    return {};
  }
}