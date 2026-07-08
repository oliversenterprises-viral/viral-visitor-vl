/**
 * Closed-loop viral optimizer — pure diagnosis, scoring, and experiment math.
 */

import { filterTestVisitorFunnelEvents } from '../admin/visitor-funnel-stats-helpers';
import { computeVariantConversion } from './share-conversion';
import type { ShareEvent } from '../admin/share-analytics-helpers';
import {
  isViralZoneId,
  VIRAL_ZONE_FUNNEL_STEP,
  VIRAL_ZONE_LABELS,
  type ViralZoneId,
} from './viral-zones';

export type OptimizerPriority = 'high' | 'medium' | 'low';

export interface ViralHealthMetrics {
  landings: number;
  getLink: number;
  copyLink: number;
  shares: number;
  referredLandings: number;
  referredGetLink: number;
  getLinkRate: number;
  referredGetLinkRate: number;
  shareAfterGetLinkRate: number;
  kScore: number;
  referralsPerShare: number | null;
}

export interface OptimizerOpportunity {
  id: string;
  priority: OptimizerPriority;
  title: string;
  evidence: string;
  suggestedAction: string;
  metric: string;
  /** early = below ideal sample size but directionally useful */
  confidence?: 'early' | 'confirmed';
  /** One-click fix in admin when set */
  actionId?: 'promote-ab' | 'enable-share-first' | 'clear-ab-default';
  actionPayload?: Record<string, unknown>;
}

export interface ZoneHeatRow {
  zoneId: ViralZoneId;
  label: string;
  clicks: number;
  funnelStep: string;
  shareOfClicks: number;
}

export interface OptimizerExperiment {
  id: string;
  name: string;
  hypothesis?: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  segment: string;
  primary_metric: string;
  guard_metric: string;
  started_at?: string | null;
  ended_at?: string | null;
  winner?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface InteractionRow {
  event_type?: string;
  zone_id?: string;
  path?: string;
  is_referred?: boolean;
  scroll_depth_pct?: number;
  x?: number;
  y?: number;
  viewport_w?: number;
  viewport_h?: number;
  created_at?: string;
}

/** Ideal samples for confirmed diagnosis */
export const OPTIMIZER_SAMPLE_TARGETS = {
  landings: 25,
  referredLandings: 15,
  getLink: 10,
  zoneClicks: 20,
  abSharesPerVariant: 5,
} as const;

/** Minimum samples for early-signal hints */
export const OPTIMIZER_EARLY_SAMPLES = {
  landings: 8,
  referredLandings: 5,
  getLink: 4,
  zoneClicks: 8,
  abSharesPerVariant: 3,
} as const;

export interface DataReadinessRow {
  id: string;
  label: string;
  current: number;
  target: number;
  early: number;
  pct: number;
  status: 'collecting' | 'early' | 'ready';
}

const MIN_LANDINGS = OPTIMIZER_SAMPLE_TARGETS.landings;
const MIN_REFERRED = OPTIMIZER_SAMPLE_TARGETS.referredLandings;
const MIN_GET_LINK = OPTIMIZER_SAMPLE_TARGETS.getLink;

function eventName(e: Record<string, unknown>): string {
  return String(e.event_name || e.eventName || '');
}

function visitorId(e: Record<string, unknown>): string | null {
  const id = String(e.visitor_id || e.visitorId || '').trim();
  return id || null;
}

function isReferredEvent(e: Record<string, unknown>): boolean {
  const meta = (e.metadata && typeof e.metadata === 'object' ? e.metadata : {}) as Record<
    string,
    unknown
  >;
  if (meta.is_referred === true || meta.referred === true) return true;
  const path = String(meta.path || '');
  if (/\/r\/[A-Za-z0-9_-]+/i.test(path)) return true;
  const ref = String(e.ref_code || e.refCode || '').trim();
  return !!ref;
}

function uniqueVisitorsFor(
  events: readonly Record<string, unknown>[],
  eventNameFilter?: string,
  referredOnly = false,
): number {
  const ids = new Set<string>();
  for (const e of events) {
    if (eventNameFilter && eventName(e) !== eventNameFilter) continue;
    if (referredOnly && !isReferredEvent(e)) continue;
    const id = visitorId(e);
    if (id) ids.add(id);
  }
  return ids.size;
}

export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function computeViralHealth(
  rawVisitorEvents: readonly Record<string, unknown>[],
  shares: readonly ShareEvent[],
  referralCounts: Readonly<Record<string, number>>,
): ViralHealthMetrics {
  const events = filterTestVisitorFunnelEvents([...rawVisitorEvents]);

  const landings = uniqueVisitorsFor(events, 'SiteLanding');
  const getLink = uniqueVisitorsFor(events, 'GetReferralLink');
  const copyLink = uniqueVisitorsFor(events, 'CopyReferralLink');
  const shareVisitors = uniqueVisitorsFor(events, 'ShareReferral');
  const referredLandings = uniqueVisitorsFor(events, 'SiteLanding', true);
  const referredGetLink = uniqueVisitorsFor(events, 'GetReferralLink', true);

  const totalShares = shares.length;
  let totalReferrals = 0;
  for (const s of shares) {
    const code = String(s.referrer_code || '').toUpperCase();
    totalReferrals += referralCounts[code] ?? 0;
  }
  const referralsPerShare = totalShares > 0 ? totalReferrals / totalShares : null;

  const getLinkRate = rate(getLink, landings);
  const referredGetLinkRate = rate(referredGetLink, referredLandings);
  const shareAfterGetLinkRate = rate(shareVisitors, getLink);
  const kScore = referredGetLinkRate * shareAfterGetLinkRate * (referralsPerShare ?? 0);

  return {
    landings,
    getLink,
    copyLink,
    shares: shareVisitors,
    referredLandings,
    referredGetLink,
    getLinkRate,
    referredGetLinkRate,
    shareAfterGetLinkRate,
    kScore,
    referralsPerShare,
  };
}

export function computeDataReadiness(
  health: ViralHealthMetrics,
  interactions: readonly InteractionRow[],
  shares: readonly ShareEvent[],
): DataReadinessRow[] {
  const clickCount = interactions.filter((i) => i.event_type === 'click').length;
  const aShares = shares.filter((s) => s.ab_variant === 'a').length;
  const bShares = shares.filter((s) => s.ab_variant === 'b').length;
  const abMin = Math.min(aShares, bShares);

  const rows: Array<Omit<DataReadinessRow, 'pct' | 'status'>> = [
    {
      id: 'landings',
      label: 'Unique landings',
      current: health.landings,
      target: OPTIMIZER_SAMPLE_TARGETS.landings,
      early: OPTIMIZER_EARLY_SAMPLES.landings,
    },
    {
      id: 'referred',
      label: 'Referred landings',
      current: health.referredLandings,
      target: OPTIMIZER_SAMPLE_TARGETS.referredLandings,
      early: OPTIMIZER_EARLY_SAMPLES.referredLandings,
    },
    {
      id: 'clicks',
      label: 'Zone clicks',
      current: clickCount,
      target: OPTIMIZER_SAMPLE_TARGETS.zoneClicks,
      early: OPTIMIZER_EARLY_SAMPLES.zoneClicks,
    },
    {
      id: 'ab',
      label: 'A/B shares (min variant)',
      current: abMin,
      target: OPTIMIZER_SAMPLE_TARGETS.abSharesPerVariant,
      early: OPTIMIZER_EARLY_SAMPLES.abSharesPerVariant,
    },
  ];

  return rows.map((r) => {
    const pct = Math.min(100, Math.round((r.current / r.target) * 100));
    let status: DataReadinessRow['status'] = 'collecting';
    if (r.current >= r.target) status = 'ready';
    else if (r.current >= r.early) status = 'early';
    return { ...r, pct, status };
  });
}

export function detectOptimizerOpportunities(
  rawVisitorEvents: readonly Record<string, unknown>[],
  shares: readonly ShareEvent[],
  referralCounts: Readonly<Record<string, number>>,
  interactions: readonly InteractionRow[] = [],
): OptimizerOpportunity[] {
  const health = computeViralHealth(rawVisitorEvents, shares, referralCounts);
  const conversion = computeVariantConversion(shares, referralCounts);
  const out: OptimizerOpportunity[] = [];
  const E = OPTIMIZER_EARLY_SAMPLES;

  const pushReferredHero = (confirmed: boolean) => {
    if (health.referredGetLinkRate >= 0.35) return;
    out.push({
      id: confirmed ? 'referred-hero-leak' : 'referred-hero-leak-early',
      priority: confirmed ? 'high' : 'medium',
      confidence: confirmed ? 'confirmed' : 'early',
      title: 'Referred visitors stall before getting a link',
      evidence: `${(health.referredGetLinkRate * 100).toFixed(0)}% of referred visitors get a link (${health.referredGetLink}/${health.referredLandings} unique)`,
      suggestedAction:
        'Shorten referred hero copy, enlarge Step 1 CTA, or move trust-pack stakes above the fold on /r/* landings.',
      metric: 'referredGetLinkRate',
    });
  };
  if (health.referredLandings >= MIN_REFERRED) pushReferredHero(true);
  else if (health.referredLandings >= E.referredLandings) pushReferredHero(false);

  const pushShareLeak = (confirmed: boolean) => {
    if (health.shareAfterGetLinkRate >= 0.4) return;
    out.push({
      id: confirmed ? 'share-panel-leak' : 'share-panel-leak-early',
      priority: confirmed ? 'high' : 'medium',
      confidence: confirmed ? 'confirmed' : 'early',
      title: 'Users get a link but rarely share',
      evidence: `${(health.shareAfterGetLinkRate * 100).toFixed(0)}% who get a link also share (${health.shares}/${health.getLink} unique)`,
      suggestedAction:
        'Surface share row earlier on mobile, strengthen rank CTA, or enable Share-first on referred mobile.',
      metric: 'shareAfterGetLinkRate',
      actionId: 'enable-share-first',
    });
  };
  if (health.getLink >= MIN_GET_LINK) pushShareLeak(true);
  else if (health.getLink >= E.getLink) pushShareLeak(false);

  if (health.landings >= MIN_LANDINGS && health.getLinkRate < 0.25) {
    out.push({
      id: 'organic-hero-leak',
      priority: 'medium',
      confidence: 'confirmed',
      title: 'Direct visitors rarely start the funnel',
      evidence: `${(health.getLinkRate * 100).toFixed(0)}% landing → get-link (${health.getLink}/${health.landings} unique)`,
      suggestedAction:
        'Clarify hero CTA contrast, add social proof near Get my link, or reduce competing leaderboard button weight.',
      metric: 'getLinkRate',
    });
  } else if (health.landings >= E.landings && health.landings < MIN_LANDINGS && health.getLinkRate < 0.2) {
    out.push({
      id: 'organic-hero-leak-early',
      priority: 'low',
      confidence: 'early',
      title: 'Early signal: hero conversion looks weak',
      evidence: `${(health.getLinkRate * 100).toFixed(0)}% landing → get-link (${health.getLink}/${health.landings} unique, small sample)`,
      suggestedAction: 'Watch hero CTA — confirm again after more landings.',
      metric: 'getLinkRate',
    });
  }

  const a = conversion.rows.find((r) => r.variant === 'a');
  const b = conversion.rows.find((r) => r.variant === 'b');
  const pushAbWinner = (confirmed: boolean, minShares: number) => {
    if (!a || !b || a.referralsPerShare === b.referralsPerShare) return;
    const leader = conversion.leaderVariant;
    const gap = Math.abs(a.referralsPerShare - b.referralsPerShare);
    const gapThreshold = confirmed ? 0.15 : 0.08;
    if (!leader || gap < gapThreshold) return;
    if (a.shareCount < minShares || b.shareCount < minShares) return;
    out.push({
      id: confirmed ? 'share-ab-winner' : 'share-ab-winner-early',
      priority: confirmed ? 'medium' : 'low',
      confidence: confirmed ? 'confirmed' : 'early',
      title: `Share message variant ${leader.toUpperCase()} converts better`,
      evidence: conversion.insight,
      suggestedAction: confirmed
        ? `Promote variant ${leader.toUpperCase()} as site default (one-click below).`
        : `Early lean toward variant ${leader.toUpperCase()} — promote after more shares.`,
      metric: 'referralsPerShare',
      actionId: 'promote-ab',
      actionPayload: { variant: leader },
    });
  };
  const abConfirmed =
    (a?.shareCount ?? 0) >= OPTIMIZER_SAMPLE_TARGETS.abSharesPerVariant &&
    (b?.shareCount ?? 0) >= OPTIMIZER_SAMPLE_TARGETS.abSharesPerVariant;
  if (abConfirmed) pushAbWinner(true, OPTIMIZER_SAMPLE_TARGETS.abSharesPerVariant);
  else pushAbWinner(false, OPTIMIZER_EARLY_SAMPLES.abSharesPerVariant);

  const zoneClicks = aggregateZoneClicks(interactions);
  const sharePanelClicks = zoneClicks.get('share-panel') ?? 0;
  const shareX = zoneClicks.get('share-x') ?? 0;
  const shareWa = zoneClicks.get('share-whatsapp') ?? 0;
  const zoneMin = sharePanelClicks >= OPTIMIZER_SAMPLE_TARGETS.zoneClicks;
  const zoneEarly = sharePanelClicks >= OPTIMIZER_EARLY_SAMPLES.zoneClicks;
  if (
    (zoneMin || zoneEarly) &&
    health.shareAfterGetLinkRate < 0.5 &&
    shareX + shareWa < sharePanelClicks * 0.2
  ) {
    out.push({
      id: zoneMin ? 'zone-intent-mismatch' : 'zone-intent-mismatch-early',
      priority: 'low',
      confidence: zoneMin ? 'confirmed' : 'early',
      title: 'Share panel gets clicks but platform buttons underperform',
      evidence: `${sharePanelClicks} panel clicks vs ${shareX + shareWa} X/WhatsApp zone hits`,
      suggestedAction:
        'Check miss-tap targets on mobile; enlarge WhatsApp Quick Boost and verify share handlers fire.',
      metric: 'zone_clicks',
    });
  }

  const scroll50 = interactions.filter(
    (i) => i.event_type === 'scroll_depth' && Number(i.scroll_depth_pct) >= 50,
  ).length;
  const referredScroll50 = interactions.filter(
    (i) =>
      i.event_type === 'scroll_depth' &&
      Number(i.scroll_depth_pct) >= 50 &&
      i.is_referred === true,
  ).length;
  if (
    health.referredLandings >= (zoneEarly ? E.referredLandings : MIN_REFERRED) &&
    scroll50 > 0 &&
    referredScroll50 < health.referredLandings * 0.3
  ) {
    out.push({
      id:
        health.referredLandings >= MIN_REFERRED
          ? 'referred-scroll-leak'
          : 'referred-scroll-leak-early',
      priority: 'medium',
      confidence: health.referredLandings >= MIN_REFERRED ? 'confirmed' : 'early',
      title: 'Referred visitors may not see below-fold stakes',
      evidence: `Only ${referredScroll50} referred scroll-50%+ events vs ${health.referredLandings} referred landings`,
      suggestedAction:
        'Move prize/trust stakes into first viewport or make funnel-expand more prominent on referred landings.',
      metric: 'scroll_depth',
    });
  }

  const priorityOrder: Record<OptimizerPriority, number> = { high: 0, medium: 1, low: 2 };
  const seen = new Set<string>();
  return out
    .filter((o) => {
      const key = o.metric + o.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function aggregateZoneClicks(interactions: readonly InteractionRow[]): Map<ViralZoneId, number> {
  const map = new Map<ViralZoneId, number>();
  for (const row of interactions) {
    if (row.event_type !== 'click') continue;
    const zone = String(row.zone_id || '').trim();
    if (!isViralZoneId(zone)) continue;
    map.set(zone, (map.get(zone) ?? 0) + 1);
  }
  return map;
}

export function computeZoneHeat(interactions: readonly InteractionRow[]): ZoneHeatRow[] {
  const clicks = aggregateZoneClicks(interactions);
  const total = [...clicks.values()].reduce((s, n) => s + n, 0) || 1;
  return [...clicks.entries()]
    .map(([zoneId, count]) => ({
      zoneId,
      label: VIRAL_ZONE_LABELS[zoneId],
      clicks: count,
      funnelStep: VIRAL_ZONE_FUNNEL_STEP[zoneId],
      shareOfClicks: count / total,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export function formatPct(rateValue: number): string {
  return `${(rateValue * 100).toFixed(1)}%`;
}

export function experimentStatusLabel(status: OptimizerExperiment['status']): string {
  const map: Record<OptimizerExperiment['status'], string> = {
    draft: 'Draft',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}