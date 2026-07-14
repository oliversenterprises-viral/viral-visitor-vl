/**
 * Pure helpers: referrer_links lock / grace stats for admin panels.
 * Product rule: lock only when first real referral lands; share may add grace.
 */

export type ReferrerLinkRow = {
  status?: string | null;
  share_grace_count?: number | null;
  created_at?: string | null;
  deadline_at?: string | null;
  first_share_platform?: string | null;
  first_verified_share_at?: string | null;
  referrer_code?: string | null;
};

export type ReferrerLinkStatsSummary = {
  total: number;
  pending: number;
  active: number;
  expired: number;
  lockedByFirstReferral: number;
  withGrace: number;
  graceExtensionsTotal: number;
  expiringSoon24h: number;
  /** Simple one-liner for 5th-grade admin explanation */
  plainEnglish: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizeReferrerLinkRows(
  rows: readonly ReferrerLinkRow[],
  now = Date.now(),
): ReferrerLinkStatsSummary {
  let pending = 0;
  let active = 0;
  let expired = 0;
  let lockedByFirstReferral = 0;
  let withGrace = 0;
  let graceExtensionsTotal = 0;
  let expiringSoon24h = 0;

  for (const row of rows) {
    const status = String(row.status || '').toLowerCase();
    if (status === 'pending_share') pending += 1;
    else if (status === 'active') active += 1;
    else if (status === 'expired') expired += 1;

    const platform = String(row.first_share_platform || '').toLowerCase();
    if (status === 'active' && platform === 'first_referral') {
      lockedByFirstReferral += 1;
    }

    const grace = Math.max(0, Number(row.share_grace_count) || 0);
    if (grace > 0) {
      withGrace += 1;
      graceExtensionsTotal += grace;
    }

    if (status === 'pending_share' && row.deadline_at) {
      const end = Date.parse(row.deadline_at);
      if (Number.isFinite(end) && end > now && end - now <= DAY_MS) {
        expiringSoon24h += 1;
      }
    }
  }

  const total = rows.length;
  const plainEnglish =
    total === 0
      ? 'No link timers yet. When people get a free link, they show up here.'
      : `${pending} waiting for a first friend · ${active} locked (friend joined) · ${expired} timed out` +
        (expiringSoon24h > 0 ? ` · ${expiringSoon24h} run out in under 1 day` : '') +
        (withGrace > 0 ? ` · ${withGrace} got extra time from sharing` : '');

  return {
    total,
    pending,
    active,
    expired,
    lockedByFirstReferral,
    withGrace,
    graceExtensionsTotal,
    expiringSoon24h,
    plainEnglish,
  };
}

export function buildReferrerLinkStatsHtml(summary: ReferrerLinkStatsSummary): string {
  const s = summary;
  return `
    <div class="rounded-xl border border-amber-400/25 bg-amber-500/5 px-3 py-2.5 mb-3" data-referrer-link-stats>
      <div class="text-[10px] font-bold uppercase tracking-wide text-amber-200/95 mb-1">
        Link lock (first friend)
      </div>
      <p class="text-[10px] text-zinc-300 leading-snug mb-2">
        Easy rule: a free link is <strong class="text-white">not locked</strong> until a real friend
        opens it and taps <strong class="text-white">Get my link</strong>. Sharing can add extra time.
        Opening an app alone does not lock.
      </p>
      <p class="text-[10px] text-amber-100/90 mb-2">${escapeAttr(s.plainEnglish)}</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
        <div class="rounded-lg bg-zinc-950/50 border border-white/10 px-1.5 py-1">
          <div class="text-[8px] text-zinc-500 uppercase">Waiting</div>
          <div class="text-base font-bold text-amber-200 tabular-nums">${s.pending}</div>
        </div>
        <div class="rounded-lg bg-zinc-950/50 border border-white/10 px-1.5 py-1">
          <div class="text-[8px] text-zinc-500 uppercase">Locked</div>
          <div class="text-base font-bold text-emerald-300 tabular-nums">${s.active}</div>
        </div>
        <div class="rounded-lg bg-zinc-950/50 border border-white/10 px-1.5 py-1">
          <div class="text-[8px] text-zinc-500 uppercase">Timed out</div>
          <div class="text-base font-bold text-rose-300/90 tabular-nums">${s.expired}</div>
        </div>
        <div class="rounded-lg bg-zinc-950/50 border border-white/10 px-1.5 py-1">
          <div class="text-[8px] text-zinc-500 uppercase">Grace used</div>
          <div class="text-base font-bold text-violet-200 tabular-nums">${s.withGrace}</div>
        </div>
      </div>
      <div class="text-[9px] text-zinc-500 mt-1.5">
        Locked by first friend: <span class="text-zinc-300 tabular-nums">${s.lockedByFirstReferral}</span>
        · Extra grace adds: <span class="text-zinc-300 tabular-nums">${s.graceExtensionsTotal}</span>
        · Under 24h left: <span class="text-zinc-300 tabular-nums">${s.expiringSoon24h}</span>
        · Total codes: <span class="text-zinc-300 tabular-nums">${s.total}</span>
      </div>
    </div>`;
}

function escapeAttr(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
