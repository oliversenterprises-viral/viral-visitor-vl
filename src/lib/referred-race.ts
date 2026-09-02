/**
 * Helix Bet 3 — referred landing is one race: credit them, then send yours.
 */

export const SAME_RACE_SUB =
  'Tap Get my link so they get credit — then send yours and try to beat them.';

export const SAME_RACE_CTA = 'Get my link';

export const SEND_NOW_LABEL = 'Send it now';

export function formatSameRaceTitle(code: string): string {
  const clean = String(code || '')
    .trim()
    .toUpperCase();
  return clean ? `You're in the same race as ${clean}.` : "You're in the same race.";
}

export function formatSameRaceHeadline(code: string): string {
  const clean = String(code || '')
    .trim()
    .toUpperCase();
  return clean ? `You're in the same race as ${clean}` : "You're in the same race";
}

/** Paint the referred first viewport. Hero is the only job. */
export function paintReferredRaceHero(code: string): void {
  const title = formatSameRaceTitle(code);

  const line1 = document.getElementById('hero-title-line1');
  if (line1) line1.textContent = title;

  const accent = document.getElementById('hero-title-accent');
  if (accent) {
    accent.textContent = '';
    accent.setAttribute('aria-hidden', 'true');
  }

  const subtitle = document.getElementById('hero-subtitle');
  if (subtitle) subtitle.textContent = SAME_RACE_SUB;

  const ctaSpan = document.querySelector('#hero-get-link-btn span');
  if (ctaSpan) ctaSpan.textContent = SAME_RACE_CTA;

  const navCta = document.getElementById('nav-get-link-btn');
  if (navCta) {
    // Hidden nav must not be the first DOM match for "Get my link".
    navCta.hidden = true;
    navCta.setAttribute('aria-hidden', 'true');
    navCta.setAttribute('inert', '');
  }

  const badge = document.getElementById('hero-badge');
  if (badge) badge.textContent = 'SAME RACE';

  const trust = document.getElementById('hero-trust-line');
  if (trust) trust.textContent = '';

  const lock = document.getElementById('hero-lock-rule');
  if (lock) lock.textContent = '';

  const headline = document.getElementById('referrer-invite-headline');
  if (headline) headline.textContent = formatSameRaceHeadline(code);

  const hint = document.getElementById('referrer-invite-hint');
  if (hint) {
    hint.textContent = SAME_RACE_SUB;
    hint.classList.remove('hidden');
  }

  const inline = document.getElementById('referrer-code-inline');
  if (inline) inline.textContent = String(code || '').trim().toUpperCase();

  const attrLabel = document.querySelector('#attribution-get-link-btn span');
  if (attrLabel) attrLabel.textContent = SAME_RACE_CTA;
}
