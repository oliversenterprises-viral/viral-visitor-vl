/**
 * Targeted compliance notices for specific referrer codes.
 * Shown only to the code owner (localStorage vr_my_ref_code), never to visitors
 * who only land on /r/CODE.
 *
 * Keep messages firm, specific, and non-accusatory. Prefer real unique friends.
 */

export type ReferrerComplianceNotice = {
  /** Stable id — bump to re-show after dismiss (e.g. jl8-same-ip-v1). */
  id: string;
  title: string;
  body: string;
  /** Optional short line for the stats panel banner. */
  banner?: string;
};

/** Exact-code notices (uppercase VIRAL-*). */
export const REFERRER_COMPLIANCE_NOTICES: Readonly<Record<string, ReferrerComplianceNotice>> = {
  'VIRAL-JL8QR8M': {
    id: 'jl8-same-ip-v1',
    title: 'Important: one signup per network',
    body:
      'ViralRefer only counts real, unique friends. Multiple signups from the same IP / network for the same referral link are not allowed and may be removed. Please stop creating extra accounts or repeat clicks from the same connection — share your link with real people only. Continued same-IP activity can lead to link limits or removal from the leaderboard.',
    banner:
      'Rules reminder: do not register multiple referrals from the same IP. Real unique friends only.',
  },
};

export function normalizeNoticeCode(code: string | null | undefined): string {
  return String(code || '')
    .trim()
    .toUpperCase();
}

export function getReferrerComplianceNotice(
  code: string | null | undefined,
): ReferrerComplianceNotice | null {
  const normalized = normalizeNoticeCode(code);
  if (!normalized) return null;
  return REFERRER_COMPLIANCE_NOTICES[normalized] ?? null;
}

export function noticeAckStorageKey(noticeId: string): string {
  return `vr_ref_notice_ack_${noticeId}`;
}

export function isNoticeAcknowledged(
  noticeId: string,
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(noticeAckStorageKey(noticeId)) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeNotice(
  noticeId: string,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(noticeAckStorageKey(noticeId), '1');
  } catch {
    /* private mode / quota — non-fatal */
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline banner HTML for the "Your Stats" panel (safe escaped). */
export function buildComplianceBannerHtml(notice: ReferrerComplianceNotice): string {
  const text = escapeHtml(notice.banner || notice.title);
  return `
    <div id="vr-ref-compliance-banner" class="mb-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-left" role="status">
      <div class="flex gap-3 items-start">
        <span class="text-amber-300 text-lg shrink-0" aria-hidden="true">⚠️</span>
        <div>
          <p class="text-sm font-semibold text-amber-100">${escapeHtml(notice.title)}</p>
          <p class="text-xs text-amber-100/90 mt-1 leading-relaxed">${text}</p>
        </div>
      </div>
    </div>
  `;
}

const MODAL_ROOT_ID = 'vr-ref-compliance-modal';

/**
 * Show a one-time modal for the code owner until they acknowledge.
 * Safe to call repeatedly — no-ops if already ack'd or modal present.
 */
export function maybeShowReferrerComplianceModal(
  code: string | null | undefined,
  opts: {
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
    doc?: Document;
  } = {},
): boolean {
  const notice = getReferrerComplianceNotice(code);
  if (!notice) return false;

  const storage =
    opts.storage === undefined
      ? typeof localStorage !== 'undefined'
        ? localStorage
        : null
      : opts.storage;
  if (isNoticeAcknowledged(notice.id, storage)) return false;

  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!doc?.body) return false;
  if (doc.getElementById(MODAL_ROOT_ID)) return true;

  const root = doc.createElement('div');
  root.id = MODAL_ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'vr-ref-compliance-title');
  root.className =
    'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm';
  root.innerHTML = `
    <div class="w-full max-w-md rounded-2xl border border-amber-400/40 bg-zinc-950 shadow-2xl p-5 sm:p-6">
      <p class="text-xs uppercase tracking-widest text-amber-400/90 mb-2">ViralRefer · fair play</p>
      <h2 id="vr-ref-compliance-title" class="text-lg font-bold text-white mb-3">${escapeHtml(notice.title)}</h2>
      <p class="text-sm text-zinc-300 leading-relaxed mb-5">${escapeHtml(notice.body)}</p>
      <button type="button" id="vr-ref-compliance-ack"
        class="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-colors">
        I understand — real unique friends only
      </button>
    </div>
  `;

  const close = () => {
    acknowledgeNotice(notice.id, storage);
    root.remove();
  };

  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  doc.body.appendChild(root);
  const btn = root.querySelector('#vr-ref-compliance-ack');
  btn?.addEventListener('click', close);
  return true;
}
