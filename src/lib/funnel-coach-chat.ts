/**
 * Floating funnel coach chat — guides visitors through get-link → copy → share.
 */

import type { CoachChatAction, CoachChatMessage } from './funnel-coach-chat-helpers';
import {
  getCoachGreeting,
  getCoachStepNudge,
  readCoachChatContext,
  resolveCoachReply,
} from './funnel-coach-chat-helpers';
import { resolveFunnelGuideTargetId } from './funnel-guide-helpers';
import {
  isFunnelCoachActive,
  isFunnelCoachSiteEnabled,
  setFunnelCoachVisitorEnabled,
} from './funnel-coach-prefs';

const ROOT_ID = 'funnel-coach-chat';
const RESTORE_ID = 'funnel-coach-restore';
const MAX_MESSAGES = 40;

let initialized = false;
let lastNudgeStep: string | null = null;
let observer: MutationObserver | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attributionBannerVisible(): boolean {
  const banner = document.getElementById('referral-attribution');
  if (!banner || banner.classList.contains('hidden')) return false;
  return window.getComputedStyle(banner).display !== 'none';
}

function runCoachAction(kind: CoachChatAction['kind']): void {
  switch (kind) {
    case 'get-link': {
      const id = resolveFunnelGuideTargetId(1, {
        attributionBannerVisible: attributionBannerVisible(),
      });
      document.getElementById(id)?.click();
      const fn = (window as unknown as { getMyReferralLinkInstant?: () => void })
        .getMyReferralLinkInstant;
      if (typeof fn === 'function') fn();
      break;
    }
    case 'copy-link':
      document.getElementById('copy-link-btn')?.click();
      break;
    case 'share': {
      document.getElementById('share-whatsapp-primary')?.click();
      document.getElementById('share-buttons-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
    case 'leaderboard':
      document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'prize':
      document.getElementById('prize')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'help':
      document.getElementById('funnel-journey')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
  }
}

function renderMessages(messages: CoachChatMessage[]): void {
  const list = document.getElementById('funnel-coach-chat-messages');
  if (!list) return;
  list.innerHTML = messages
    .map((m) => {
      const cls = m.role === 'coach' ? 'funnel-coach-chat-bubble--coach' : 'funnel-coach-chat-bubble--visitor';
      return `<div class="funnel-coach-chat-bubble ${cls}" data-msg-id="${escapeHtml(m.id)}">${escapeHtml(m.text)}</div>`;
    })
    .join('');
  list.scrollTop = list.scrollHeight;
}

function renderActions(actions: CoachChatAction[] | undefined, onAction: (a: CoachChatAction) => void): void {
  const row = document.getElementById('funnel-coach-chat-actions');
  if (!row) return;
  if (!actions?.length) {
    row.innerHTML = '';
    return;
  }
  row.innerHTML = actions
    .map(
      (a) =>
        `<button type="button" class="funnel-coach-chat-chip" data-action-kind="${a.kind}">${escapeHtml(a.label)}</button>`,
    )
    .join('');
  row.querySelectorAll<HTMLButtonElement>('[data-action-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-action-kind') as CoachChatAction['kind'];
      const action = actions.find((a) => a.kind === kind);
      if (action) onAction(action);
    });
  });
}

function setPanelOpen(open: boolean): void {
  const panel = document.getElementById('funnel-coach-chat-panel');
  const toggle = document.getElementById('funnel-coach-chat-toggle');
  const badge = document.getElementById('funnel-coach-chat-badge');
  if (!panel || !toggle) return;
  panel.classList.toggle('hidden', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) badge?.classList.add('hidden');
}

function bumpUnreadBadge(): void {
  const panel = document.getElementById('funnel-coach-chat-panel');
  const badge = document.getElementById('funnel-coach-chat-badge');
  if (!panel || panel.classList.contains('hidden')) {
    badge?.classList.remove('hidden');
  }
}

function buildRestorePill(): void {
  if (document.getElementById(RESTORE_ID)) return;
  const btn = document.createElement('button');
  btn.id = RESTORE_ID;
  btn.type = 'button';
  btn.className = 'funnel-coach-restore hidden';
  btn.setAttribute('data-vr-zone', 'funnel-coach-restore');
  btn.title = 'Show Viral Coach';
  btn.setAttribute('aria-label', 'Show Viral Coach');
  btn.innerHTML =
    '<i class="fa-solid fa-robot" aria-hidden="true"></i><span class="funnel-coach-restore-label">Coach</span>';
  btn.addEventListener('click', () => {
    setFunnelCoachVisitorEnabled(true);
    applyFunnelCoachVisibility();
    if (!initialized) initFunnelCoachChat();
  });
  document.body.appendChild(btn);
}

/** Sync coach widget + restore pill with site flag and visitor preference. */
export function applyFunnelCoachVisibility(): void {
  const root = document.getElementById(ROOT_ID);
  const restore = document.getElementById(RESTORE_ID);

  if (!isFunnelCoachSiteEnabled()) {
    root?.classList.add('hidden');
    restore?.classList.add('hidden');
    return;
  }

  const active = isFunnelCoachActive();
  if (root) root.classList.toggle('hidden', !active);
  if (restore) restore.classList.toggle('hidden', active);
}

/** Called when optimizer flags change site-wide coach setting. */
export function refreshFunnelCoachVisibility(): void {
  applyFunnelCoachVisibility();
}

function buildShell(): void {
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = 'funnel-coach-chat';
  root.setAttribute('data-vr-zone', 'funnel-coach');
  root.innerHTML = `
    <button type="button" id="funnel-coach-chat-toggle" class="funnel-coach-chat-toggle" aria-expanded="false" aria-controls="funnel-coach-chat-panel" title="Funnel coach">
      <i class="fa-solid fa-robot" aria-hidden="true"></i>
      <span class="sr-only">Open funnel coach</span>
      <span id="funnel-coach-chat-badge" class="funnel-coach-chat-badge hidden" aria-hidden="true">1</span>
    </button>
    <div id="funnel-coach-chat-panel" class="funnel-coach-chat-panel hidden" role="dialog" aria-labelledby="funnel-coach-chat-title">
      <header class="funnel-coach-chat-header">
        <div>
          <div id="funnel-coach-chat-title" class="funnel-coach-chat-title">Viral Coach</div>
          <div class="funnel-coach-chat-sub">Guides you: link → copy → share</div>
        </div>
        <div class="funnel-coach-chat-header-actions">
          <button type="button" id="funnel-coach-chat-hide" class="funnel-coach-chat-hide" title="Hide Viral Coach">Hide</button>
          <button type="button" id="funnel-coach-chat-close" class="funnel-coach-chat-close" aria-label="Close coach">✕</button>
        </div>
      </header>
      <div id="funnel-coach-chat-messages" class="funnel-coach-chat-messages" aria-live="polite"></div>
      <div id="funnel-coach-chat-actions" class="funnel-coach-chat-actions"></div>
      <form id="funnel-coach-chat-form" class="funnel-coach-chat-form">
        <input type="text" id="funnel-coach-chat-input" class="funnel-coach-chat-input" placeholder="Ask how to win, share, or get your link…" autocomplete="off" maxlength="200" />
        <button type="submit" class="funnel-coach-chat-send" aria-label="Send">↑</button>
      </form>
    </div>`;
  document.body.appendChild(root);
}

/** Idempotent bootstrap — observes funnel step attributes for proactive nudges. */
export function initFunnelCoachChat(): void {
  buildRestorePill();

  if (!isFunnelCoachSiteEnabled()) {
    applyFunnelCoachVisibility();
    return;
  }

  if (!isFunnelCoachActive()) {
    applyFunnelCoachVisibility();
    return;
  }

  if (initialized) {
    applyFunnelCoachVisibility();
    return;
  }
  initialized = true;

  buildShell();
  applyFunnelCoachVisibility();

  const messages: CoachChatMessage[] = [];
  let msgSeq = 0;

  const pushMessage = (msg: CoachChatMessage, fromVisitor = false): void => {
    if (!fromVisitor) bumpUnreadBadge();
    messages.push({ ...msg, id: `${msg.id}-${++msgSeq}` });
    while (messages.length > MAX_MESSAGES) messages.shift();
    renderMessages(messages);
    renderActions(msg.actions, handleAction);
  };

  const handleAction = (action: CoachChatAction): void => {
    pushMessage({ id: 'visitor-action', role: 'visitor', text: action.label }, true);
    runCoachAction(action.kind);
    if (action.kind === 'help') {
      pushMessage(resolveCoachReply('where am i', readCoachChatContext()));
      return;
    }
    if (action.kind === 'prize') {
      pushMessage(resolveCoachReply('what do I win', readCoachChatContext()));
      return;
    }
    const ctx = readCoachChatContext();
    const nudge = getCoachStepNudge(ctx);
    if (nudge) pushMessage(nudge);
  };

  const toggle = document.getElementById('funnel-coach-chat-toggle');
  const close = document.getElementById('funnel-coach-chat-close');
  const hide = document.getElementById('funnel-coach-chat-hide');
  const form = document.getElementById('funnel-coach-chat-form') as HTMLFormElement | null;
  const input = document.getElementById('funnel-coach-chat-input') as HTMLInputElement | null;

  toggle?.addEventListener('click', () => {
    const panel = document.getElementById('funnel-coach-chat-panel');
    const open = panel?.classList.contains('hidden');
    setPanelOpen(!!open);
    if (open && messages.length === 0) {
      const greet = getCoachGreeting(readCoachChatContext());
      pushMessage(greet);
      renderActions(greet.actions, handleAction);
    } else if (open) {
      renderActions(messages[messages.length - 1]?.actions, handleAction);
    }
  });

  close?.addEventListener('click', () => setPanelOpen(false));

  hide?.addEventListener('click', () => {
    setPanelOpen(false);
    setFunnelCoachVisitorEnabled(false);
    applyFunnelCoachVisibility();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input?.value.trim() || '';
    if (!text) return;
    if (input) input.value = '';
    pushMessage({ id: 'visitor-text', role: 'visitor', text }, true);
    pushMessage(resolveCoachReply(text, readCoachChatContext()));
  });

  pushMessage(getCoachGreeting(readCoachChatContext()));

  const onFunnelAttrChange = (): void => {
    const ctx = readCoachChatContext();
    const stepKey = ctx.step === null ? 'none' : String(ctx.step);
    if (stepKey === lastNudgeStep) return;
    lastNudgeStep = stepKey;
    const nudge = getCoachStepNudge(ctx);
    if (nudge) pushMessage(nudge);
  };

  observer = new MutationObserver(onFunnelAttrChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      'data-vr-funnel-guide-step',
      'data-vr-funnel-complete',
      'data-vr-credit-status',
    ],
  });

  lastNudgeStep = readCoachChatContext().step === null ? 'none' : String(readCoachChatContext().step);

  window.setTimeout(() => {
    if (document.documentElement.hasAttribute('data-vr-referred-landing')) {
      toggle?.classList.add('funnel-coach-chat-toggle--pulse');
      window.setTimeout(() => toggle?.classList.remove('funnel-coach-chat-toggle--pulse'), 8000);
    }
  }, 2500);
}