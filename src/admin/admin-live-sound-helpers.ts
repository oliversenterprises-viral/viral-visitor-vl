/**
 * Pure helpers — which admin live events should trigger audible funnel alerts.
 */

import {
  shouldShowAdminLiveEvent,
  type AdminLiveEvent,
  type AdminLiveFeedFilters,
} from './admin-live-helpers';

/** Funnel steps that represent real visitor conversion (not passive landings). */
export const IMPORTANT_FUNNEL_STEPS = new Set([
  'getreferrallink',
  'copyreferrallink',
  'sharereferral',
  'openprizeclaim',
  'submitprizeclaim',
]);

export type AdminLiveSoundProfile = 'funnel' | 'referral' | 'share' | 'claim';

export function normalizeFunnelStep(step: string | undefined): string {
  return (step || '').trim().toLowerCase();
}

export function isImportantFunnelStep(step: string | undefined): boolean {
  return IMPORTANT_FUNNEL_STEPS.has(normalizeFunnelStep(step));
}

/** Map a live feed event to a sound profile, or null when not alert-worthy. */
export function adminLiveSoundProfileForEvent(ev: AdminLiveEvent): AdminLiveSoundProfile | null {
  if (ev.kind === 'referral') return 'referral';
  if (ev.kind === 'share') return 'share';
  if (ev.kind === 'claim') return 'claim';
  if (ev.kind === 'visitor' && isImportantFunnelStep(ev.funnelStep)) return 'funnel';
  return null;
}

/** Whether this realtime event should play an admin sound alert. */
export function shouldPlayAdminLiveSound(
  ev: AdminLiveEvent,
  filters: AdminLiveFeedFilters,
  eventType = 'INSERT',
): boolean {
  if (!shouldShowAdminLiveEvent(ev, filters)) return false;
  const profile = adminLiveSoundProfileForEvent(ev);
  if (!profile) return false;
  if (ev.kind === 'claim' && eventType !== 'INSERT') return false;
  return true;
}