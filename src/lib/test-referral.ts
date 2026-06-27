/** Client filters — shared logic with record-referral edge + SQL RPCs. */

export {
  isAutomationUserAgent,
  isOwnerReferralIp,
  isTestReferralRecord,
  isTestReferrerCode,
  shouldSkipReferralCrediting,
} from '../../supabase/functions/_shared/test-referral';