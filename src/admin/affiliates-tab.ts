/**
 * Owner desk — promoters you pay when they send real Get my link visitors.
 * Does not change leaderboard credit.
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import { escapeHtml } from '../lib/escape-html';
import { showToast } from '../ui';
import { fetchSiteContent } from '../lib/supabase';
import { fetchVisitorFunnelEvents } from '../lib/visitor-funnel-fetch';
import { isTestVisitorFunnelEvent } from '../../supabase/functions/_shared/visitor-funnel-test';
import {
  AFFILIATES_SITE_CONTENT_KEY,
  addAffiliate,
  buildAffiliateLink,
  computeAffiliateRewards,
  computeAffiliateStats,
  markAffiliateAdCredit,
  markAffiliatePaid,
  parseAffiliatesProgram,
  setAffiliateActive,
  type AffiliatesProgram,
} from '../lib/affiliate';

async function saveProgram(program: AffiliatesProgram): Promise<boolean> {
  const result = await invokeAdminAction('update_site_content', {
    key: AFFILIATES_SITE_CONTENT_KEY,
    value: program,
  });
  if (!result.success) {
    showToast(result.error || 'Could not save promoters', 'info');
    return false;
  }
  return true;
}

export async function renderAffiliatesTab(content: HTMLElement): Promise<void> {
  content.innerHTML = `
    <div class="space-y-3 py-2">
      <div class="h-8 w-48 skeleton rounded-xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>`;

  const [siteContent, funnel] = await Promise.all([fetchSiteContent(), fetchVisitorFunnelEvents()]);
  let program = parseAffiliatesProgram(siteContent[AFFILIATES_SITE_CONTENT_KEY]);
  const events = (funnel.events || []).filter((row) => !isTestVisitorFunnelEvent(row));

  const paint = () => {
    const rows = program.affiliates
      .map((row) => {
        const stats = computeAffiliateStats(events, row.code, row.paid_count);
        const rewards = computeAffiliateRewards(stats, program, row);
        const link = buildAffiliateLink(row.code);
        const status = row.active ? 'On' : 'Paused';
        const source = row.source === 'self' ? 'Signed up' : 'Added by you';
        return `
        <article class="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 space-y-2" data-aff-code="${escapeHtml(row.code)}">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div class="text-sm font-semibold text-white">${escapeHtml(row.name)}</div>
              <div class="text-[11px] text-zinc-500 font-mono">${escapeHtml(row.code)} · ${source}</div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full border ${
              row.active
                ? 'border-emerald-400/30 text-emerald-300'
                : 'border-white/15 text-zinc-500'
            }">${status}</span>
          </div>
          <div class="text-[12px] text-zinc-300 break-all font-mono">${escapeHtml(link)}</div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-white/5 px-2 py-1.5">
              <div class="text-[8px] uppercase text-zinc-500">Visits</div>
              <div class="text-lg font-bold tabular-nums">${stats.landings}</div>
            </div>
            <div class="rounded-lg bg-white/5 px-2 py-1.5">
              <div class="text-[8px] uppercase text-zinc-500">Got a link</div>
              <div class="text-lg font-bold text-emerald-300 tabular-nums">${stats.uniqueGetLinkVisitors}</div>
            </div>
            <div class="rounded-lg bg-white/5 px-2 py-1.5">
              <div class="text-[8px] uppercase text-zinc-500">Ad days owed</div>
              <div class="text-lg font-bold text-amber-300 tabular-nums">${rewards.adCreditOwed}</div>
            </div>
          </div>
          ${
            rewards.cashDue
              ? `<div class="text-[11px] text-amber-300">Cash bonus due · ${rewards.cashUnpaid} unpaid (threshold ${rewards.cashThreshold})</div>`
              : `<div class="text-[11px] text-zinc-500">Cash bonus after ${rewards.cashThreshold} people (${stats.uniqueGetLinkVisitors} so far)</div>`
          }
          <div class="flex flex-wrap gap-2">
            <button type="button" data-aff-copy class="text-[10px] px-2 py-1 rounded-xl bg-white/10 hover:bg-white/15">Copy link</button>
            <button type="button" data-aff-toggle class="text-[10px] px-2 py-1 rounded-xl border border-white/15">${
              row.active ? 'Pause' : 'Turn on'
            }</button>
            <button type="button" data-aff-ad class="text-[10px] px-2 py-1 rounded-xl border border-emerald-400/30 text-emerald-200" ${
              stats.uniqueGetLinkVisitors === 0 ? 'disabled' : ''
            }>Mark ad credit given</button>
            <button type="button" data-aff-paid class="text-[10px] px-2 py-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white" ${
              !rewards.cashDue ? 'disabled' : ''
            }>Mark cash paid</button>
          </div>
        </article>`;
      })
      .join('');

    content.innerHTML = `
      <div class="mb-5">
        <div class="text-2xl font-bold">Promoters</div>
        <p class="text-sm text-zinc-400 mt-1">People can sign up on the public site. Default thank-you is ad-board credit. Cash bonus after ${program.cash_threshold} Get my links — you mark it paid.</p>
        <p class="text-[11px] text-zinc-500 mt-2">${escapeHtml(program.payout_note)}</p>
      </div>

      <form id="affiliate-add-form" class="mb-5 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4 space-y-3">
        <div class="text-xs font-semibold text-violet-200">Add one by hand (optional)</div>
        <div class="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name" class="flex-1 min-w-[140px] bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm" />
          <input name="code" placeholder="Code (optional)" class="w-36 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm" />
          <button type="submit" class="px-4 py-2 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-500">Add</button>
        </div>
        <p class="text-[10px] text-zinc-500">Their link will look like viralrefer.app/a/CODE — not a /r/ friend link.</p>
      </form>

      <label class="block mb-5 text-[11px] text-zinc-400">
        What you pay
        <input id="affiliate-bounty" value="${escapeHtml(program.bounty_label)}"
          class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-100" />
      </label>

      <div class="grid md:grid-cols-2 gap-3">
        ${rows || '<p class="text-sm text-zinc-500">No promoters yet. They can sign up on the homepage.</p>'}
      </div>
      ${
        funnel.fetchError
          ? `<p class="text-[11px] text-amber-400/90 mt-3">Counts use ${escapeHtml(funnel.source)} data (${escapeHtml(funnel.fetchError)}).</p>`
          : `<p class="text-[10px] text-zinc-600 mt-3">Counts from ${escapeHtml(funnel.source)} visitor events.</p>`
      }
    `;

    content.querySelector('#affiliate-add-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const name = String(new FormData(form).get('name') || '');
      const code = String(new FormData(form).get('code') || '');
      const next = addAffiliate(program, { name, code: code || undefined, source: 'owner' });
      if (next.error || !next.program) {
        showToast(next.error || 'Could not add', 'info');
        return;
      }
      void saveProgram(next.program).then((ok) => {
        if (!ok) return;
        program = next.program;
        showToast('Promoter added', 'success');
        paint();
      });
    });

    content.querySelector('#affiliate-bounty')?.addEventListener('change', (e) => {
      const label = String((e.target as HTMLInputElement).value || '').trim();
      if (!label) return;
      const next = { ...program, bounty_label: label };
      void saveProgram(next).then((ok) => {
        if (!ok) return;
        program = next;
        showToast('Pay note saved', 'success');
      });
    });

    content.querySelectorAll<HTMLElement>('[data-aff-code]').forEach((card) => {
      const code = card.dataset.affCode || '';
      const row = program.affiliates.find((a) => a.code === code);
      if (!row) return;
      card.querySelector('[data-aff-copy]')?.addEventListener('click', () => {
        void navigator.clipboard.writeText(buildAffiliateLink(code)).then(() => {
          showToast('Link copied', 'success');
        });
      });
      card.querySelector('[data-aff-toggle]')?.addEventListener('click', () => {
        const next = setAffiliateActive(program, code, !row.active);
        void saveProgram(next).then((ok) => {
          if (!ok) return;
          program = next;
          paint();
        });
      });
      card.querySelector('[data-aff-ad]')?.addEventListener('click', () => {
        const stats = computeAffiliateStats(events, code, 0);
        const next = markAffiliateAdCredit(program, code, stats.uniqueGetLinkVisitors);
        void saveProgram(next).then((ok) => {
          if (!ok) return;
          program = next;
          showToast('Ad credit marked given', 'success');
          paint();
        });
      });
      card.querySelector('[data-aff-paid]')?.addEventListener('click', () => {
        const stats = computeAffiliateStats(events, code, 0);
        const next = markAffiliatePaid(program, code, stats.uniqueGetLinkVisitors);
        void saveProgram(next).then((ok) => {
          if (!ok) return;
          program = next;
          showToast('Cash marked paid', 'success');
          paint();
        });
      });
    });
  };

  paint();
}
