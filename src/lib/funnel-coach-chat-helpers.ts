/**
 * Funnel coach chat — contextual replies and quick actions (rule-based AI coach).
 */

import type { FunnelStep } from './funnel-conversion';
import { getFunnelGuideCopy } from './funnel-guide-helpers';
import { t, type MessageKey } from './i18n';

export type CoachChatStep = FunnelStep | 'complete' | null;

export interface CoachChatContext {
  step: CoachChatStep;
  isReferred: boolean;
  referrerCode: string | null;
  creditStatus: string | null;
}

export type CoachChatActionKind =
  | 'get-link'
  | 'copy-link'
  | 'share'
  | 'leaderboard'
  | 'prize'
  | 'help';

export interface CoachChatAction {
  id: string;
  label: string;
  kind: CoachChatActionKind;
}

export interface CoachChatMessage {
  id: string;
  role: 'coach' | 'visitor';
  text: string;
  actions?: CoachChatAction[];
}

export function parseCoachChatStep(raw: string | null): CoachChatStep {
  if (!raw) return null;
  if (raw === 'complete') return 'complete';
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

export function readCoachChatContext(doc: Document = document): CoachChatContext {
  const root = doc.documentElement;
  const step = root.hasAttribute('data-vr-funnel-complete')
    ? 'complete'
    : parseCoachChatStep(root.getAttribute('data-vr-funnel-guide-step'));
  return {
    step,
    isReferred: root.hasAttribute('data-vr-referred-landing'),
    referrerCode: doc.getElementById('referrer-code-inline')?.textContent?.trim() || null,
    creditStatus: root.getAttribute('data-vr-credit-status'),
  };
}

function tr(key: string, vars?: Record<string, string | number>): string {
  return t(key as MessageKey, vars);
}

export function getCoachGreeting(ctx: CoachChatContext): CoachChatMessage {
  if (ctx.step === 'complete') {
    return coachMsg(
      'greet-complete',
      'You shared — nice work! Every click through your link climbs the live leaderboard. Want to check your rank?',
      quickActions(ctx),
    );
  }

  if (ctx.isReferred && ctx.referrerCode) {
    const credit =
      ctx.creditStatus === 'credited' ? tr('coach.credit_ok') : tr('coach.credit_need');
    return coachMsg(
      'greet-referred',
      tr('coach.greet_referred', { code: ctx.referrerCode, credit }),
      quickActions(ctx),
    );
  }

  return coachMsg('greet-direct', tr('coach.greet_direct'), quickActions(ctx));
}

export function getCoachStepNudge(ctx: CoachChatContext): CoachChatMessage | null {
  if (!ctx.step || ctx.step === 'complete') return null;
  const guide = getFunnelGuideCopy(ctx.step);
  const prefix =
    ctx.step === 1 && ctx.isReferred && ctx.creditStatus !== 'credited'
      ? 'Step 1 unlocks your referral credit. '
      : '';
  return coachMsg(`nudge-${ctx.step}`, `${prefix}${guide.message}`, quickActions(ctx));
}

export function quickActions(ctx: CoachChatContext): CoachChatAction[] {
  const step = ctx.step;
  const actions: CoachChatAction[] = [];

  if (step === 1 || step === null) {
    actions.push({ id: 'act-get-link', label: tr('coach.act_get_link'), kind: 'get-link' });
  }
  if (step === 2) {
    actions.push({ id: 'act-copy', label: tr('coach.act_copy'), kind: 'copy-link' });
  }
  if (step === 3) {
    actions.push({ id: 'act-share', label: tr('coach.act_share'), kind: 'share' });
  }
  if (step === 'complete') {
    actions.push({ id: 'act-leaderboard', label: tr('coach.act_board'), kind: 'leaderboard' });
  }

  actions.push({ id: 'act-prize', label: tr('coach.act_prize'), kind: 'prize' });
  actions.push({ id: 'act-help', label: tr('coach.act_help'), kind: 'help' });
  return actions;
}

export function resolveCoachReply(input: string, ctx: CoachChatContext): CoachChatMessage {
  const q = input.trim().toLowerCase();
  if (!q) {
    return coachMsg('empty', "Type a question or tap a button — I'm here to guide you.", quickActions(ctx));
  }

  if (/^(hi|hello|hey|help|start)/.test(q)) {
    return getCoachGreeting(ctx);
  }

  if (/where am i|what step|status|progress/.test(q)) {
    return coachMsg('status', describeStepStatus(ctx), quickActions(ctx));
  }

  if (/win|prize|reward|\$10|cash|banner|#1|leader|feature/.test(q)) {
    return coachMsg('prize', tr('coach.prize_reply'), [
      { id: 'act-leaderboard', label: tr('coach.act_board'), kind: 'leaderboard' },
      ...quickActions(ctx).filter((a) => a.kind !== 'prize'),
    ]);
  }

  if (/free|cost|signup|email|pay/.test(q)) {
    return coachMsg('free', tr('coach.free_reply'), quickActions(ctx));
  }

  if (/get link|referral link|my link|step 1/.test(q)) {
    return coachMsg('get-link', getFunnelGuideCopy(1).message, [
      { id: 'act-get-link', label: 'Get my link', kind: 'get-link' },
      ...quickActions(ctx).filter((a) => a.kind !== 'get-link'),
    ]);
  }

  if (/copy|step 2|clipboard/.test(q)) {
    return coachMsg('copy', getFunnelGuideCopy(2).message, [
      { id: 'act-copy', label: 'Copy my link', kind: 'copy-link' },
      ...quickActions(ctx).filter((a) => a.kind !== 'copy-link'),
    ]);
  }

  if (/share|whatsapp|step 3|send/.test(q)) {
    return coachMsg('share', getFunnelGuideCopy(3).message, [
      { id: 'act-share', label: 'Share now', kind: 'share' },
      ...quickActions(ctx).filter((a) => a.kind !== 'share'),
    ]);
  }

  if (/credit|referred|count/.test(q) && ctx.isReferred) {
    const status =
      ctx.creditStatus === 'credited'
        ? 'Your visit is credited — keep going with copy and share.'
        : 'Just visiting does not credit your referrer. Step 1 (Get my link) is required.';
    return coachMsg('credit', status, quickActions(ctx));
  }

  const nudge = getCoachStepNudge(ctx);
  if (nudge) {
    return coachMsg(
      'fallback-step',
      `I'm not sure on that one — here's your next move: ${nudge.text}`,
      quickActions(ctx),
    );
  }

  return coachMsg('fallback', tr('coach.fallback'), quickActions(ctx));
}

function describeStepStatus(ctx: CoachChatContext): string {
  if (ctx.step === 'complete') {
    return "You're on the final stretch — share complete! Check the leaderboard to see your rank.";
  }
  if (ctx.step === 1) {
    return ctx.isReferred
      ? 'Step 1 of 3: Get my referral link (required to credit your visit).'
      : 'Step 1 of 3: Get my referral link.';
  }
  if (ctx.step === 2) return 'Step 2 of 3: Copy your link to the clipboard.';
  if (ctx.step === 3) return 'Step 3 of 3: Share on WhatsApp or any platform below.';
  return 'Step 1 of 3: Get my referral link to begin.';
}

function coachMsg(id: string, text: string, actions?: CoachChatAction[]): CoachChatMessage {
  return { id, role: 'coach', text, actions };
}