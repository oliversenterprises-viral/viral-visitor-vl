/** Banner test/owner filtering — shared with admin-action edge. */

export {
  countTestBannerEvents,
  filterTestBannerEvents,
  getBannerEventIp,
  getBannerEventUserAgent,
  isAutomationUserAgent,
  isTestBannerEvent,
} from '../../supabase/functions/_shared/admin-stats-test';