/**
 * Owner desk — promoter /a/ codes and credited Get-links.
 * No cash. No mint.
 */

import { escapeHtml } from '../lib/escape-html';
import { showToast } from '../ui';
import { fetchSiteContent } from '../lib/supabase';
import { fetchVisitorFunnelEvents } from '../lib/visitor-funnel-fetch';
import { isTestVisitorFunnelEvent } from '../../supabase/functions/_shared/visitor-funnel-test';
import {
  AFFILIATES_SITE_CONTENT_KEY,
  buildAffiliateLink,
  computeAffiliateStats,
  parseAffiliatesProgram,
} from '../lib/affiliate';

export async function renderAffiliatesTab(content: HTMLElement): Promise<void> {
  content.innerHTML = `
    <div class="space-y-3 py-2">
      <div class="h-8 w-48 skeleton rounded-xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>`;

  const [siteContent, funnel] = await Promise.all([fetchSiteContent(), fetchVisitorFunnelEvents()]);
  const program = parseAffiliatesProgram(siteContent[AFFILIATES_SITE_CONTENT_KEY]);
  const events = (funnel.events || []).filter((row) => !isTestVisitorFunnelEvent(row));

  const rows = program.affiliates
    .map((row) => {
      const stats = computeAffiliateStats(events, row.code, row.paid_count);
      const link = buildAffiliateLink(row.code);
      return `
        <article class="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 space-y-2" data-aff-code="${escapeHtml(row.code)}">
          <div>
            <div class="text-sm font-semibold text-white">${escapeHtml(row.name)}</div>
            <div class="text-[11px] text-zinc-500 font-mono">${escapeHtml(row.code)}</div>
          </div>
          <div class="text-[12px] text-zinc-300 break-all font-mono">${escapeHtml(link)}</div>
          <div class="rounded-lg bg-white/5 px-3 py-2">
            <div class="text-[8px] uppercase text-zinc-500">Credited Get-links</div>
            <div class="text-lg font-bold text-emerald-300 tabular-nums">${stats.uniqueGetLinkVisitors}</div>
          </div>
          <button type="button" data-aff-copy class="text-[10px] px-2 py-1 rounded-xl bg-white/10 hover:bg-white/15">Copy link</button>
        </article>`;
    })
    .join('');

  content.innerHTML = `
    <div class="mb-5">
      <div class="text-2xl font-bold">Promoters</div>
      <p class="text-sm text-zinc-400 mt-1">/a/ codes and credited Get-links. No cash.</p>
    </div>
    <div class="grid md:grid-cols-2 gap-3">
      ${rows || '<p class="text-sm text-zinc-500">No promoters yet.</p>'}
    </div>
  `;

  content.querySelectorAll<HTMLElement>('[data-aff-code]').forEach((card) => {
    const code = card.dataset.affCode || '';
    card.querySelector('[data-aff-copy]')?.addEventListener('click', () => {
      void navigator.clipboard.writeText(buildAffiliateLink(code)).then(() => {
        showToast('Link copied', 'success');
      });
    });
  });
}
