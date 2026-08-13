/**
 * Auto-grant spendable ad-board days when a promoter's visitor taps Get my link.
 * Same Supabase project as ads.viralrefer.app — no owner click.
 */

import {
  AFFILIATES_SITE_CONTENT_KEY,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  parseAffiliatesProgram,
} from './affiliate.ts';

export function creditIdempotencyKey(code: string, visitorId: string): string {
  return `getlink:${normalizeAffiliateCode(code)}:${String(visitorId || '').trim().slice(0, 64)}`;
}

export async function settleGetLinkAdCredit(
  supabaseAdmin: {
    from: (table: string) => any;
  },
  input: { affCode?: string | null; visitorId?: string | null; name?: string | null },
): Promise<{ granted: boolean; skipped?: string; credit_days?: number }> {
  const code = normalizeAffiliateCode(input.affCode);
  const visitorId = String(input.visitorId || '').trim();
  if (!isValidAffiliateCode(code) || !visitorId) {
    return { granted: false, skipped: 'missing' };
  }

  const key = creditIdempotencyKey(code, visitorId);
  const { error: ledErr } = await supabaseAdmin.from('ad_board_credit_ledger').insert({
    affiliate_code: code,
    days: 1,
    reason: 'visitor tapped Get my link',
    source: 'viralrefer_get_link',
    idempotency_key: key,
  });

  if (ledErr) {
    if (ledErr.code === '23505') return { granted: false, skipped: 'duplicate' };
    // Table missing until SQL 004 is applied — fail soft
    console.error('[affiliate-ads-credit] ledger', ledErr.message || ledErr);
    return { granted: false, skipped: 'ledger' };
  }

  const { data: existing } = await supabaseAdmin
    .from('ad_board_affiliates')
    .select('code, credit_days, name')
    .eq('code', code)
    .maybeSingle();

  let creditDays = 1;
  if (!existing) {
    const { data: created, error: insErr } = await supabaseAdmin
      .from('ad_board_affiliates')
      .insert({
        code,
        name: String(input.name || code).slice(0, 80),
        active: true,
        notes: 'auto_from_viralrefer_promoter',
        credit_days: 1,
      })
      .select('credit_days')
      .single();
    if (insErr) {
      console.error('[affiliate-ads-credit] insert affiliate', insErr.message || insErr);
      return { granted: false, skipped: 'insert' };
    }
    creditDays = Number(created?.credit_days) || 1;
  } else {
    creditDays = (Number(existing.credit_days) || 0) + 1;
    const { error: upErr } = await supabaseAdmin
      .from('ad_board_affiliates')
      .update({ credit_days: creditDays, updated_at: new Date().toISOString() })
      .eq('code', code);
    if (upErr) {
      console.error('[affiliate-ads-credit] bump days', upErr.message || upErr);
      return { granted: false, skipped: 'update' };
    }
  }

  try {
    const { data } = await supabaseAdmin
      .from('site_content')
      .select('value')
      .eq('key', AFFILIATES_SITE_CONTENT_KEY)
      .maybeSingle();
    const program = parseAffiliatesProgram(data?.value);
    const next = {
      ...program,
      affiliates: program.affiliates.map((row) =>
        row.code === code ? { ...row, ad_credit_granted: Math.max(row.ad_credit_granted, creditDays) } : row,
      ),
    };
    await supabaseAdmin.from('site_content').upsert(
      {
        key: AFFILIATES_SITE_CONTENT_KEY,
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  } catch {
    /* roster bump is best-effort */
  }

  return { granted: true, credit_days: creditDays };
}
