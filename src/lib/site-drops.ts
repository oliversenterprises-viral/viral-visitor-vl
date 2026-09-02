/** Client re-export of Site Drop promotion (single source: supabase/functions/_shared). */
export {
  SITE_DROPS_KEY,
  ENTERED_TTL_MS,
  RISING_TTL_MS,
  MAX_LIVE_ENTERED,
  MAX_LIVE_RISING,
  MAX_PENDING,
  SITE_DROP_RISING_MIN_LOCKS,
  CHALLENGER_RANKS,
  utcWeekId,
  hostnameFromSafeUrl,
  normalizeWebsiteUrl,
  labelFromUrl,
  isExpiredDrop,
  isStalePending,
  parseSiteDrops,
  expireSiteDrops,
  enqueuePendingEntered,
  promoteEnteredDrop,
  promoteRisingDrop,
  promoteChallengerDrop,
  publicEnteredDrops,
  publicRisingDrops,
  publicChallengerDrops,
  publicPendingEntered,
} from '../../supabase/functions/_shared/site-drops';

export type {
  SiteDropKind,
  PendingEntered,
  SiteDrop,
  SiteDropsState,
} from '../../supabase/functions/_shared/site-drops';
