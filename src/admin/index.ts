// Barrel file for admin modules
// Allows cleaner imports like: import { renderReferralsTab } from './admin'

// Light admin tabs (statically imported by the orchestrator)
export { renderReferralsTab } from './referrals-tab';
export { renderEditContentTab } from './edit-content-tab';
export { renderPrizeClaimsTab } from './prize-claims-tab';

// Heavy tabs are intentionally NOT re-exported here because they are loaded
// via dynamic import() in switchAdminTab for code-splitting.
// Consumers that need them should import directly:
//   const { renderShareAnalyticsTab } = await import('./admin/share-analytics-tab');
//   const { renderTextColorsTab } = await import('./admin/text-colors-tab');

export {
  adminClaimsCache,
  adminReferralsCache,
  replaceReferralsCache,
  replaceClaimsCache,
  updateReferralInCache,
  updateClaimInCache,
  type AdminReferralRow,
  type AdminClaimRow,
} from './state';

export { switchAdminTab } from './switcher';
