// Barrel for shared lib utilities (Supabase client, typed queries, global registration, core domain types)
export { ViralRefer, registerGlobal } from './global';
export { supabase, fetchLeaderboard, fetchTotalReferrers, fetchRecentActivity, fetchSiteContent } from './supabase';
export { formatError } from './error';
export type * from './types';  // re-export all domain types for consumers (Profile, Referral, PrizeClaim, etc.)
