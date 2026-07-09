import { fetchSiteContent } from '../lib/supabase';
import { invokeAdminAction } from '../lib/admin-action-client';
import { formatAutopilotCronLabel, AUTOPILOT_CRON_PATH } from '../lib/autopilot-schedule';
import { escapeHtml } from '../content';
import { showToast } from '../ui';
import { getVisitorEventsForStats } from '../lib/visitor-tracking';
import { getLocalInteractionEvents } from '../lib/interaction-tracking';
import {
  computeDataReadiness,
  computeZoneHeat,
  computeViralHealth,
  detectOptimizerOpportunities,
  experimentStatusLabel,
  formatPct,
  type DataReadinessRow,
  type InteractionRow,
  type OptimizerExperiment,
  type OptimizerOpportunity,
} from '../lib/viral-optimizer-helpers';
import {
  buildPixelHeatmapCss,
  computePixelHeatmap,
} from '../lib/optimizer-heatmap';
import {
  getOptimizerFlags,
  parseOptimizerFlagsFromContent,
  serializeOptimizerFlags,
  setOptimizerFlags,
  siteContentKeyForOptimizerFlags,
  type OptimizerFlags,
} from '../lib/optimizer-flags';
import type { ShareAbVariant } from '../lib/share-ab';
import {
  normalizeShareRow,
  type ShareEvent,
} from './share-analytics-helpers';
import { registerAdminLiveRefresh } from './admin-live-hub';

let unregisterOptimizerLive: (() => void) | null = null;

async function fetchInteractions(): Promise<{
  rows: InteractionRow[];
  source: 'server' | 'local';
  fetchError?: string;
}> {
  const local = getLocalInteractionEvents() as InteractionRow[];
  const result = await invokeAdminAction<InteractionRow[]>('get_interaction_stats');
  if (!result.success || !Array.isArray(result.data)) {
    return {
      rows: local,
      source: 'local',
      fetchError: result.success ? 'Invalid get_interaction_stats response' : result.error,
    };
  }
  return { rows: result.data, source: 'server' };
}

async function fetchShares(): Promise<ShareEvent[]> {
  const result = await invokeAdminAction<Record<string, unknown>[]>('get_shares');
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map((row) => normalizeShareRow(row));
}

async function fetchReferralCounts(): Promise<Record<string, number>> {
  const result = await invokeAdminAction<Record<string, number>>('get_referral_counts');
  if (!result.success || !result.data) return {};
  return result.data;
}

async function fetchExperiments(): Promise<OptimizerExperiment[]> {
  const result = await invokeAdminAction<OptimizerExperiment[]>('get_optimizer_experiments');
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data;
}

async function runAutopilotFromAdmin(dryRun: boolean): Promise<string | null> {
  const result = await invokeAdminAction<{ decision?: { reason?: string } }>('run_optimizer_autopilot', {
    dry_run: dryRun,
  });
  if (!result.success) {
    return result.error || 'Autopilot failed';
  }
  const decision = result.data?.decision;
  return decision?.reason || (dryRun ? 'Dry run complete' : 'Autopilot complete');
}

async function saveOptimizerFlagsToServer(flags: OptimizerFlags): Promise<boolean> {
  const value = serializeOptimizerFlags(flags);
  const result = await invokeAdminAction('update_site_content', {
    key: siteContentKeyForOptimizerFlags(),
    value,
  });
  if (!result.success) {
    showToast(result.error || 'Flag save failed', 'info');
    return false;
  }
  setOptimizerFlags(value);
  return true;
}

async function saveExperiment(experiment: Partial<OptimizerExperiment>): Promise<boolean> {
  const result = await invokeAdminAction('upsert_optimizer_experiment', { experiment });
  if (!result.success) {
    showToast(result.error || 'Save failed', 'info');
    return false;
  }
  return true;
}

function priorityBadge(priority: string): string {
  const colors: Record<string, string> = {
    high: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    medium: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
    low: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/20',
  };
  const cls = colors[priority] || colors.low;
  return `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg border ${cls}">${escapeHtml(priority)}</span>`;
}

function renderHealthCards(health: ReturnType<typeof computeViralHealth>): string {
  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="glass rounded-2xl p-4 border border-violet-500/20">
        <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">K score (proxy)</div>
        <div class="text-2xl font-bold text-violet-300">${health.kScore.toFixed(2)}</div>
        <div class="text-xs text-zinc-500 mt-1">referred × share × referrals/share</div>
      </div>
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Referred → get link</div>
        <div class="text-2xl font-bold text-emerald-300">${formatPct(health.referredGetLinkRate)}</div>
        <div class="text-xs text-zinc-500 mt-1">${health.referredGetLink} / ${health.referredLandings} unique</div>
      </div>
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Get link → share</div>
        <div class="text-2xl font-bold text-cyan-300">${formatPct(health.shareAfterGetLinkRate)}</div>
        <div class="text-xs text-zinc-500 mt-1">${health.shares} / ${health.getLink} unique</div>
      </div>
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Referrals / share</div>
        <div class="text-2xl font-bold text-amber-300">${health.referralsPerShare != null ? health.referralsPerShare.toFixed(2) : '—'}</div>
        <div class="text-xs text-zinc-500 mt-1">from share analytics cohort</div>
      </div>
    </div>`;
}

function confidenceBadge(confidence?: OptimizerOpportunity['confidence']): string {
  if (!confidence || confidence === 'confirmed') return '';
  return `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg border bg-sky-500/15 text-sky-300 border-sky-400/25">early signal</span>`;
}

function actionButton(o: OptimizerOpportunity): string {
  if (!o.actionId) return '';
  const variant = String(o.actionPayload?.variant || '').toUpperCase();
  if (o.actionId === 'promote-ab' && variant) {
    return `<button type="button" data-optimizer-action="promote-ab" data-ab-variant="${variant.toLowerCase()}" class="mt-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white">Promote variant ${variant}</button>`;
  }
  if (o.actionId === 'enable-share-first') {
    return `<button type="button" data-optimizer-action="enable-share-first" class="mt-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white">Enable share-first (referred mobile)</button>`;
  }
  return '';
}

function renderOpportunities(
  opportunities: ReturnType<typeof detectOptimizerOpportunities>,
  readiness: DataReadinessRow[],
): string {
  if (!opportunities.length) {
    const collecting = readiness.every((r) => r.status === 'collecting');
    return `<p class="text-sm text-zinc-500 py-4">${
      collecting
        ? 'Collecting data — early signals appear once minimum samples are met (see progress below).'
        : 'No major leaks detected right now. Keep monitoring as traffic grows.'
    }</p>`;
  }
  return `<div class="space-y-3">${opportunities
    .map(
      (o) => `
      <div class="rounded-2xl border border-white/10 bg-zinc-900/40 p-4" data-opportunity-id="${escapeHtml(o.id)}">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          ${priorityBadge(o.priority)}
          ${confidenceBadge(o.confidence)}
          <h4 class="font-semibold text-white text-sm">${escapeHtml(o.title)}</h4>
        </div>
        <p class="text-xs text-zinc-400 mb-2">${escapeHtml(o.evidence)}</p>
        <p class="text-xs text-violet-300/90"><strong>Suggested:</strong> ${escapeHtml(o.suggestedAction)}</p>
        ${actionButton(o)}
      </div>`,
    )
    .join('')}</div>`;
}

function renderDataReadiness(rows: DataReadinessRow[]): string {
  return `<div class="space-y-2">${rows
    .map((r) => {
      const color =
        r.status === 'ready'
          ? 'bg-emerald-500'
          : r.status === 'early'
            ? 'bg-amber-400'
            : 'bg-zinc-600';
      return `
      <div class="text-xs">
        <div class="flex justify-between text-zinc-400 mb-1">
          <span>${escapeHtml(r.label)}</span>
          <span class="tabular-nums">${r.current} / ${r.target}${r.status === 'early' ? ' (early)' : ''}</span>
        </div>
        <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full ${color} rounded-full transition-all" style="width:${r.pct}%"></div>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

function renderPixelHeatmap(interactions: InteractionRow[]): string {
  const heat = computePixelHeatmap(interactions);
  if (!heat.totalClicks) {
    return `<p class="text-sm text-zinc-500 py-2">Pixel map fills in as click coordinates are captured (${heat.totalClicks} clicks).</p>`;
  }
  const css = buildPixelHeatmapCss(heat);
  return `
    <div class="rounded-2xl border border-white/10 overflow-hidden bg-zinc-950 relative" style="width:100%;max-width:390px;height:220px;background-image:${css};background-color:#09090b">
      <div class="absolute inset-x-0 bottom-0 px-3 py-2 text-[10px] text-zinc-500 bg-gradient-to-t from-zinc-950/90 to-transparent">
        ${heat.totalClicks} clicks · normalized to ${heat.refWidth}×${heat.refHeight} mobile
      </div>
    </div>`;
}

function formatAutopilotStatus(flags: OptimizerFlags): string {
  const lastRun = flags.auto_pilot_last_run_at
    ? new Date(flags.auto_pilot_last_run_at).toLocaleString()
    : 'never';
  const result = flags.auto_pilot_last_result || '—';
  return `Last run: ${lastRun} · ${result}`;
}

function growthEngineStatusBadge(status: OptimizerFlags['growth_engine_status']): string {
  const map: Record<string, string> = {
    collecting: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    optimizing: 'bg-violet-500/20 text-violet-300 border-violet-400/30',
    acting: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    paused: 'bg-zinc-500/20 text-zinc-400 border-zinc-400/20',
  };
  const label = status || 'collecting';
  const cls = map[label] || map.collecting;
  return `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg border ${cls}">${escapeHtml(label)}</span>`;
}

function formatGrowthEngineAction(action: string | null | undefined): string {
  if (!action || action === 'none') return '—';
  if (action === 'promote_ab') return 'Promoted A/B winner';
  if (action === 'enable_share_first') return 'Enabled share-first (referred mobile)';
  return action;
}

function renderGrowthEngineCard(flags: OptimizerFlags): string {
  const enabled = flags.growth_engine === true || flags.auto_pilot === true;
  const kScore =
    flags.growth_engine_k_score != null ? flags.growth_engine_k_score.toFixed(3) : '—';
  const lastRun = flags.growth_engine_last_run_at
    ? new Date(flags.growth_engine_last_run_at).toLocaleString()
    : 'never';
  const version = flags.growth_engine_version || '3b';
  const lastAction = formatGrowthEngineAction(flags.growth_engine_last_action);
  const result = flags.auto_pilot_last_result || '—';

  return `
    <div class="rounded-2xl border border-orange-500/25 bg-orange-500/5 p-4 space-y-2 mb-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-xs font-bold uppercase tracking-wider text-orange-300">Growth engine</div>
        ${growthEngineStatusBadge(flags.growth_engine_status)}
        <span class="text-[10px] text-zinc-500">v${escapeHtml(version)}</span>
      </div>
      <p class="text-sm text-zinc-200">${
        enabled
          ? '<span class="text-emerald-400">Active</span> — measure → decide → act loop'
          : '<span class="text-zinc-400">Paused</span> — enable auto-pilot to activate'
      }</p>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-[10px] uppercase text-zinc-500">K score (stored)</div>
          <div class="text-lg font-bold text-orange-300 tabular-nums">${kScore}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase text-zinc-500">Last auto action</div>
          <div class="text-sm text-zinc-300">${escapeHtml(lastAction)}</div>
        </div>
      </div>
      <p class="text-[11px] text-zinc-500">Last cycle: ${escapeHtml(lastRun)}</p>
      <p class="text-[11px] text-zinc-400">${escapeHtml(result)}</p>
      <p class="text-[10px] text-zinc-500">Priority: A/B promote (3a) → share-first on leak (3b). Never edits homepage copy.</p>
    </div>`;
}

function renderActiveFlags(flags: OptimizerFlags): string {
  const ab = flags.share_ab_default
    ? `Variant ${flags.share_ab_default.toUpperCase()} promoted`
    : 'A/B split (per code hash)';
  const shareFirst = flags.referred_share_first
    ? 'Share-first on referred mobile: ON'
    : 'Share-first on referred mobile: OFF';
  const heroCta =
    flags.hero_cta_variant === 'prize'
      ? 'Hero CTA: feature variant (homepage claim)'
      : 'Hero CTA: control (CMS/static copy)';
  const visitorSlim =
    flags.visitor_slim === false
      ? '<span class="text-zinc-400">Visitor slim OFF</span> (full UI)'
      : '<span class="text-emerald-400">Visitor slim ON</span> (segment-aware layout)';
  const funnelCoach =
    flags.funnel_coach === false
      ? '<span class="text-zinc-400">Viral Coach OFF</span> (hidden site-wide)'
      : '<span class="text-emerald-400">Viral Coach ON</span> (floating guide)';
  const autoPilot = flags.auto_pilot
    ? '<span class="text-emerald-400">Auto-pilot ON</span> (A/B + growth engine)'
    : '<span class="text-zinc-400">Auto-pilot OFF</span> (cron runs but won\'t act)';
  const schedule = flags.autopilot_schedule || formatAutopilotCronLabel();
  const via = flags.autopilot_via ? ` via ${flags.autopilot_via}` : '';
  return `
    <div class="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2 mb-3">
      <div class="text-xs font-bold uppercase tracking-wider text-emerald-300">Autopilot operations</div>
      <p class="text-sm text-zinc-200">Scheduled: <span class="text-emerald-300/90">${escapeHtml(schedule)}</span>${escapeHtml(via)}</p>
      <p class="text-[11px] text-zinc-500 font-mono">${escapeHtml(AUTOPILOT_CRON_PATH)} → optimizer-cron edge</p>
      <p class="text-[11px] text-zinc-400">Guardrails: ≥5 shares/variant · ≥0.15 referrals/share gap · 48h cooldown · never edits homepage copy</p>
    </div>
    ${renderGrowthEngineCard(flags)}
    <div class="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
      <div class="text-xs font-bold uppercase tracking-wider text-violet-300">Live optimizer flags</div>
      <p class="text-sm text-zinc-300">${escapeHtml(ab)} · ${escapeHtml(shareFirst)}</p>
      <p class="text-sm text-zinc-300">${escapeHtml(heroCta)}</p>
      <p class="text-sm">${visitorSlim}</p>
      <p class="text-sm">${funnelCoach}</p>
      <p class="text-sm">${autoPilot}</p>
      <p class="text-[11px] text-zinc-500">${escapeHtml(formatAutopilotStatus(flags))}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-optimizer-flag-toggle="auto_pilot" class="text-xs px-3 py-1.5 rounded-xl border ${flags.auto_pilot ? 'border-emerald-400/40 text-emerald-300' : 'border-white/15'} hover:bg-white/10">
          ${flags.auto_pilot ? 'Disable auto-pilot' : 'Enable auto-pilot'}
        </button>
        <button type="button" data-optimizer-autopilot-dryrun class="text-xs px-3 py-1.5 rounded-xl border border-sky-400/30 text-sky-300 hover:bg-sky-500/10">
          Preview autopilot
        </button>
        <button type="button" data-optimizer-autopilot-run class="text-xs px-3 py-1.5 rounded-xl border border-violet-400/30 text-violet-300 hover:bg-violet-500/10">
          Run autopilot now
        </button>
        <button type="button" data-optimizer-flag-toggle="referred_share_first" class="text-xs px-3 py-1.5 rounded-xl border border-white/15 hover:bg-white/10">
          Toggle share-first
        </button>
        <button type="button" data-optimizer-flag-toggle="hero_cta_variant" class="text-xs px-3 py-1.5 rounded-xl border ${flags.hero_cta_variant === 'prize' ? 'border-amber-400/40 text-amber-300' : 'border-white/15'} hover:bg-white/10">
          Toggle hero CTA (prize/control)
        </button>
        <button type="button" data-optimizer-flag-toggle="visitor_slim" class="text-xs px-3 py-1.5 rounded-xl border ${flags.visitor_slim === false ? 'border-white/15' : 'border-emerald-400/40 text-emerald-300'} hover:bg-white/10">
          ${flags.visitor_slim === false ? 'Enable visitor slim' : 'Disable visitor slim'}
        </button>
        <button type="button" data-optimizer-flag-toggle="funnel_coach" class="text-xs px-3 py-1.5 rounded-xl border ${flags.funnel_coach === false ? 'border-white/15' : 'border-emerald-400/40 text-emerald-300'} hover:bg-white/10">
          ${flags.funnel_coach === false ? 'Enable Viral Coach' : 'Disable Viral Coach'}
        </button>
        <button type="button" data-optimizer-flag-clear-ab class="text-xs px-3 py-1.5 rounded-xl border border-white/15 hover:bg-white/10 ${flags.share_ab_default ? '' : 'opacity-50'}">
          Reset A/B to split
        </button>
      </div>
      <p class="text-[10px] text-zinc-500">Visitor slim: referred = primary shares + collapse extras; direct = defer How-it-works until link. Auto-pilot only promotes confirmed A/B winners (≥5 shares/variant, ≥0.15 gap, 48h cooldown).</p>
    </div>`;
}

function renderZoneHeat(rows: ReturnType<typeof computeZoneHeat>): string {
  if (!rows.length) {
    return `<p class="text-sm text-zinc-500 py-2">No zone clicks captured yet. Zones activate as visitors tap tagged UI.</p>`;
  }
  const max = rows[0]?.clicks ?? 1;
  return `
    <div class="space-y-2">
      ${rows
        .map((z) => {
          const pct = Math.round((z.clicks / max) * 100);
          return `
          <div class="flex items-center gap-3 text-sm">
            <div class="w-40 shrink-0 text-zinc-300 truncate" title="${escapeHtml(z.label)}">${escapeHtml(z.label)}</div>
            <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="w-12 text-right text-zinc-400 tabular-nums">${z.clicks}</div>
            <div class="w-14 text-right text-[10px] text-zinc-500">${escapeHtml(z.funnelStep)}</div>
          </div>`;
        })
        .join('')}
    </div>`;
}

function renderExperiments(experiments: OptimizerExperiment[]): string {
  const list =
    experiments.length === 0
      ? `<p class="text-sm text-zinc-500">No experiments logged. Start one below to close the loop.</p>`
      : `<div class="space-y-2">${experiments
          .slice(0, 8)
          .map(
            (ex) => `
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
            <div>
              <span class="font-semibold text-white">${escapeHtml(ex.name)}</span>
              <span class="text-xs text-zinc-500 ml-2">${escapeHtml(experimentStatusLabel(ex.status))}</span>
            </div>
            <div class="text-xs text-zinc-400">${escapeHtml(ex.primary_metric)} · ${escapeHtml(ex.segment)}</div>
          </div>`,
          )
          .join('')}</div>`;

  return `
    ${list}
    <form id="optimizer-new-experiment" class="mt-4 space-y-3 rounded-2xl border border-dashed border-violet-500/30 p-4">
      <div class="text-xs font-semibold text-violet-300 uppercase tracking-wider">New experiment</div>
      <input name="name" required placeholder="Experiment name" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm" />
      <textarea name="hypothesis" rows="2" placeholder="Hypothesis (e.g. move share row above fold on mobile referred)" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm"></textarea>
      <div class="flex flex-wrap gap-2">
        <button type="submit" data-optimizer-save-draft class="px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15">Save draft</button>
        <button type="button" data-optimizer-start-active class="px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-500">Start active</button>
      </div>
    </form>`;
}

function wireExperimentForm(container: HTMLElement): void {
  const form = container.querySelector<HTMLFormElement>('#optimizer-new-experiment');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  const submit = async (status: 'draft' | 'active') => {
    const name = String(new FormData(form).get('name') || '').trim();
    const hypothesis = String(new FormData(form).get('hypothesis') || '').trim();
    if (!name) return;
    const ok = await saveExperiment({
      name,
      hypothesis: hypothesis || null,
      status,
      segment: 'all',
      primary_metric: 'ShareReferral',
      guard_metric: 'GetReferralLink',
      started_at: status === 'active' ? new Date().toISOString() : null,
    });
    if (ok) {
      showToast(status === 'active' ? 'Experiment started' : 'Experiment saved', 'success');
      await renderViralOptimizerTab(container);
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit('draft');
  });
  form.querySelector('[data-optimizer-start-active]')?.addEventListener('click', () => {
    void submit('active');
  });
}

function wireRefresh(container: HTMLElement): void {
  if (container.dataset.optimizerRefreshBound === '1') return;
  container.dataset.optimizerRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-optimizer-refresh]');
    if (btn && container.contains(btn)) {
      e.preventDefault();
      void renderViralOptimizerTab(container);
      return;
    }

    const actionBtn = target.closest('[data-optimizer-action]');
    if (actionBtn && container.contains(actionBtn)) {
      e.preventDefault();
      const action = actionBtn.getAttribute('data-optimizer-action');
      void (async () => {
        const current = getOptimizerFlags();
        if (action === 'promote-ab') {
          const v = actionBtn.getAttribute('data-ab-variant') as ShareAbVariant | null;
          if (v !== 'a' && v !== 'b') return;
          const ok = await saveOptimizerFlagsToServer({ ...current, share_ab_default: v });
          if (ok) {
            showToast(`Variant ${v.toUpperCase()} promoted site-wide`, 'success');
            await saveExperiment({
              name: `Promote share variant ${v.toUpperCase()}`,
              hypothesis: 'Optimizer one-click A/B winner promotion',
              status: 'completed',
              segment: 'all',
              primary_metric: 'referralsPerShare',
              guard_metric: 'GetReferralLink',
              winner: v,
              ended_at: new Date().toISOString(),
            });
            await renderViralOptimizerTab(container);
          }
        } else if (action === 'enable-share-first') {
          const ok = await saveOptimizerFlagsToServer({ ...current, referred_share_first: true });
          if (ok) {
            showToast('Share-first enabled for referred mobile', 'success');
            await renderViralOptimizerTab(container);
          }
        }
      })();
      return;
    }

    const dryRunBtn = target.closest('[data-optimizer-autopilot-dryrun]');
    if (dryRunBtn && container.contains(dryRunBtn)) {
      e.preventDefault();
      void runAutopilotFromAdmin(true).then((msg) => {
        showToast(msg || 'Preview done', 'info');
      });
      return;
    }

    const runBtn = target.closest('[data-optimizer-autopilot-run]');
    if (runBtn && container.contains(runBtn)) {
      e.preventDefault();
      void runAutopilotFromAdmin(false).then((msg) => {
        const acted =
          msg?.includes('Promote') ||
          msg?.includes('share-first') ||
          msg?.includes('Share leak');
        showToast(msg || 'Autopilot finished', acted ? 'success' : 'info');
        void renderViralOptimizerTab(container);
      });
      return;
    }

    const flagToggle = target.closest('[data-optimizer-flag-toggle]');
    if (flagToggle && container.contains(flagToggle)) {
      e.preventDefault();
      const key = flagToggle.getAttribute('data-optimizer-flag-toggle');
      const current = getOptimizerFlags();
      if (key === 'referred_share_first') {
        void saveOptimizerFlagsToServer({
          ...current,
          referred_share_first: !current.referred_share_first,
        }).then((ok) => {
          if (ok) void renderViralOptimizerTab(container);
        });
      } else if (key === 'hero_cta_variant') {
        const next = current.hero_cta_variant === 'prize' ? 'control' : 'prize';
        void saveOptimizerFlagsToServer({
          ...current,
          hero_cta_variant: next,
        }).then((ok) => {
          if (ok) {
            showToast(`Hero CTA → ${next}`, 'success');
            void renderViralOptimizerTab(container);
          }
        });
      } else if (key === 'visitor_slim') {
        const disabling = current.visitor_slim !== false;
        void saveOptimizerFlagsToServer({
          ...current,
          visitor_slim: disabling ? false : true,
        }).then((ok) => {
          if (ok) {
            showToast(
              disabling ? 'Visitor slim disabled (full UI)' : 'Visitor slim enabled',
              'success',
            );
            void renderViralOptimizerTab(container);
          }
        });
      } else if (key === 'funnel_coach') {
        const disabling = current.funnel_coach !== false;
        void saveOptimizerFlagsToServer({
          ...current,
          funnel_coach: disabling ? false : true,
        }).then((ok) => {
          if (ok) {
            showToast(
              disabling ? 'Viral Coach disabled site-wide' : 'Viral Coach enabled site-wide',
              'success',
            );
            void renderViralOptimizerTab(container);
          }
        });
      } else if (key === 'auto_pilot') {
        const enabling = !current.auto_pilot;
        void saveOptimizerFlagsToServer({
          ...current,
          auto_pilot: enabling,
        }).then((ok) => {
          if (ok) {
            showToast(
              enabling ? 'Auto-pilot enabled (growth engine active)' : 'Auto-pilot disabled',
              'success',
            );
            void renderViralOptimizerTab(container);
          }
        });
      }
      return;
    }

    const clearAb = target.closest('[data-optimizer-flag-clear-ab]');
    if (clearAb && container.contains(clearAb)) {
      e.preventDefault();
      const current = getOptimizerFlags();
      if (!current.share_ab_default) return;
      void saveOptimizerFlagsToServer({ ...current, share_ab_default: null }).then((ok) => {
        if (ok) {
          showToast('A/B reset to per-code split', 'success');
          void renderViralOptimizerTab(container);
        }
      });
    }
  });
}

export async function renderViralOptimizerTab(container: HTMLElement): Promise<void> {
  container.dataset.vrOptimizerRoot = '1';

  const [visitorResult, interactionResult, shares, referralCounts, experiments, siteContent] =
    await Promise.all([
      getVisitorEventsForStats(),
      fetchInteractions(),
      fetchShares(),
      fetchReferralCounts(),
      fetchExperiments(),
      fetchSiteContent(),
    ]);

  const optimizerFlags = parseOptimizerFlagsFromContent(siteContent);
  setOptimizerFlags(optimizerFlags);

  const health = computeViralHealth(visitorResult.events, shares, referralCounts);
  const readiness = computeDataReadiness(health, interactionResult.rows, shares);
  const opportunities = detectOptimizerOpportunities(
    visitorResult.events,
    shares,
    referralCounts,
    interactionResult.rows,
  );
  const zoneHeat = computeZoneHeat(interactionResult.rows);

  const sourceNote = [
    visitorResult.source === 'server' ? 'funnel: server' : 'funnel: local',
    interactionResult.source === 'server' ? 'zones: server' : 'zones: local',
  ].join(' · ');

  const warnings = [visitorResult.fetchError, interactionResult.fetchError].filter(Boolean);

  container.innerHTML = `
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-fire text-orange-400"></i> Viral Optimizer
        </h2>
        <p class="text-sm text-zinc-400 mt-1">Closed-loop growth cockpit — sense, diagnose, experiment, measure.</p>
        <p class="text-[11px] text-zinc-500 mt-1">${escapeHtml(sourceNote)}</p>
        ${
          warnings.length
            ? `<p class="text-[11px] text-amber-400/90 mt-1">${escapeHtml(warnings.join(' · '))}</p>`
            : ''
        }
      </div>
      <button type="button" data-optimizer-refresh class="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-2xl flex items-center gap-2">
        <i class="fa-solid fa-sync"></i> Refresh
      </button>
    </div>

    <section class="mb-6">
      ${renderActiveFlags(optimizerFlags)}
    </section>

    <section class="mb-8">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Viral health</h3>
      ${renderHealthCards(health)}
    </section>

    <section class="mb-8">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Data readiness</h3>
      ${renderDataReadiness(readiness)}
    </section>

    <div class="grid lg:grid-cols-2 gap-6 mb-8">
      <section>
        <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Opportunity queue</h3>
        ${renderOpportunities(opportunities, readiness)}
      </section>
      <section>
        <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Zone heat (clicks)</h3>
        ${renderZoneHeat(zoneHeat)}
      </section>
    </div>

    <section class="mb-8">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Pixel heatmap (mobile-normalized)</h3>
      ${renderPixelHeatmap(interactionResult.rows)}
    </section>

    <section>
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Experiment ledger</h3>
      ${renderExperiments(experiments)}
    </section>
  `;

  wireExperimentForm(container);
  wireRefresh(container);

  unregisterOptimizerLive?.();
  unregisterOptimizerLive = registerAdminLiveRefresh('optimizer', () => {
    void renderViralOptimizerTab(container);
  });
}

export function wireViralOptimizerQuick(container: HTMLElement): void {
  void renderViralOptimizerTab(container);
}