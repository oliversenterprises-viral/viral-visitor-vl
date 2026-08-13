/** Client filters — shared logic with record-referral edge + SQL RPCs. */

import { isAutomationUserAgent as detectAutomationUserAgent } from '../../supabase/functions/_shared/test-referral';

export {
  isAgentAutomationMetadata,
  isAutomationUserAgent,
  isOwnerReferralIp,
  isTestReferralRecord,
  isTestReferrerCode,
  shouldSkipReferralCrediting,
} from '../../supabase/functions/_shared/test-referral';

/** Stamp Playwright/agent browsers so Telegram can ignore them. */
export function getClientAutomationMetadata(): Record<string, unknown> {
  try {
    if (typeof navigator === 'undefined') return {};
    const out: Record<string, unknown> = {};
    if (navigator.webdriver) out.webdriver = true;
    const ua = navigator.userAgent || '';
    if (detectAutomationUserAgent(ua)) out.automation = true;
    return out;
  } catch {
    return {};
  }
}