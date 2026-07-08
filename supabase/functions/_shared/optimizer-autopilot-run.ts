import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  computeAutopilotConversion,
  parseOptimizerFlagsPayload,
  type OptimizerFlagsPayload,
} from './optimizer-autopilot.ts';
import {
  computeGrowthHealth,
  mergeGrowthEngineRunFlags,
  resolveGrowthEngineCycle,
  type GrowthEngineCycleResult,
  type GrowthEngineDecision,
} from './growth-engine.ts';

const FLAGS_KEY = 'optimizer_flags';

async function loadFlags(supabase: SupabaseClient): Promise<OptimizerFlagsPayload> {
  const { data } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', FLAGS_KEY)
    .maybeSingle();
  return parseOptimizerFlagsPayload(data?.value);
}

async function saveFlags(supabase: SupabaseClient, flags: OptimizerFlagsPayload): Promise<void> {
  const { error } = await supabase.from('site_content').upsert(
    { key: FLAGS_KEY, value: flags, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (error) throw error;
}

async function fetchShares(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('shares')
    .select('referrer_code, ab_variant, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);
  if (error) throw error;
  return data || [];
}

async function fetchReferralCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('referrals').select('referrer_code').limit(50000);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const code = String(row.referrer_code || '').toUpperCase();
    if (!code) continue;
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

async function fetchVisitorEvents(supabase: SupabaseClient): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('visitor_events')
    .select('event_name, ref_code, visitor_id, session_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

function totalReferralsFromShareCohort(
  shares: readonly { referrer_code?: string }[],
  referralCounts: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const row of shares) {
    const code = String(row.referrer_code || '').toUpperCase();
    if (!code) continue;
    total += referralCounts[code] ?? 0;
  }
  return total;
}

export async function runOptimizerAutopilotCycle(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {},
): Promise<{
  success: boolean;
  dryRun: boolean;
  decision: GrowthEngineDecision;
  cycle: GrowthEngineCycleResult;
  flagsBefore: OptimizerFlagsPayload;
  flagsAfter?: OptimizerFlagsPayload;
}> {
  const dryRun = options.dryRun === true;
  const ranAt = new Date().toISOString();
  const flagsBefore = await loadFlags(supabase);
  const [shares, referralCounts, visitorEvents] = await Promise.all([
    fetchShares(supabase),
    fetchReferralCounts(supabase),
    fetchVisitorEvents(supabase),
  ]);
  const conversion = computeAutopilotConversion(shares, referralCounts);
  const health = computeGrowthHealth(
    visitorEvents,
    shares.length,
    totalReferralsFromShareCohort(shares, referralCounts),
  );
  const cycle = resolveGrowthEngineCycle({
    flags: flagsBefore,
    conversion,
    health,
  });

  const applied = !dryRun && cycle.finalDecision.wouldUpdateFlags;
  const flagsAfter = mergeGrowthEngineRunFlags(flagsBefore, cycle, ranAt, applied);

  if (!dryRun) {
    await saveFlags(supabase, flagsAfter);

    const { finalDecision } = cycle;
    if (applied && finalDecision.action === 'promote_ab' && finalDecision.variant) {
      await supabase.from('optimizer_experiments').insert({
        name: `Auto-promote share variant ${finalDecision.variant.toUpperCase()}`,
        hypothesis: 'Phase 3a autopilot — confirmed A/B winner',
        status: 'completed',
        segment: 'all',
        primary_metric: 'referralsPerShare',
        guard_metric: 'GetReferralLink',
        winner: finalDecision.variant,
        started_at: ranAt,
        ended_at: ranAt,
        notes: finalDecision.reason,
        metadata: { auto: true, phase: '3a' },
      });
    }
    if (applied && finalDecision.action === 'enable_share_first') {
      await supabase.from('optimizer_experiments').insert({
        name: 'Auto-enable share-first (referred mobile)',
        hypothesis: 'Phase 3b growth engine — share leak detected after get-link',
        status: 'completed',
        segment: 'referred-mobile',
        primary_metric: 'ShareReferral',
        guard_metric: 'GetReferralLink',
        winner: 'share-first',
        started_at: ranAt,
        ended_at: ranAt,
        notes: finalDecision.reason,
        metadata: { auto: true, phase: '3b' },
      });
    }
  }

  return {
    success: true,
    dryRun,
    decision: cycle.finalDecision,
    cycle,
    flagsBefore,
    flagsAfter,
  };
}