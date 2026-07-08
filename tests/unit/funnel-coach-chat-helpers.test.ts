import { describe, it, expect } from 'vitest';
import {
  getCoachGreeting,
  getCoachStepNudge,
  parseCoachChatStep,
  quickActions,
  resolveCoachReply,
} from '../../src/lib/funnel-coach-chat-helpers';

describe('funnel-coach-chat-helpers', () => {
  it('parseCoachChatStep normalizes funnel attributes', () => {
    expect(parseCoachChatStep('2')).toBe(2);
    expect(parseCoachChatStep('complete')).toBe('complete');
    expect(parseCoachChatStep('bad')).toBeNull();
  });

  it('getCoachGreeting differs for referred visitors', () => {
    const referred = getCoachGreeting({
      step: 1,
      isReferred: true,
      referrerCode: 'VIRAL-TEST',
      creditStatus: null,
    });
    expect(referred.text).toContain('VIRAL-TEST');
    expect(referred.actions?.some((a) => a.kind === 'get-link')).toBe(true);

    const direct = getCoachGreeting({
      step: 1,
      isReferred: false,
      referrerCode: null,
      creditStatus: null,
    });
    expect(direct.text).toMatch(/ViralRefer coach/i);
  });

  it('getCoachStepNudge returns step-specific copy', () => {
    const nudge = getCoachStepNudge({
      step: 2,
      isReferred: false,
      referrerCode: null,
      creditStatus: null,
    });
    expect(nudge?.text).toMatch(/COPY/i);
  });

  it('resolveCoachReply handles prize and status intents', () => {
    const prize = resolveCoachReply('what do I win', {
      step: 1,
      isReferred: false,
      referrerCode: null,
      creditStatus: null,
    });
    expect(prize.text).toMatch(/\$10|Cash App/i);

    const status = resolveCoachReply('where am I', {
      step: 3,
      isReferred: false,
      referrerCode: null,
      creditStatus: null,
    });
    expect(status.text).toMatch(/Step 3/i);
  });

  it('quickActions surfaces copy on step 2', () => {
    const actions = quickActions({
      step: 2,
      isReferred: false,
      referrerCode: null,
      creditStatus: null,
    });
    expect(actions.some((a) => a.kind === 'copy-link')).toBe(true);
    expect(actions.some((a) => a.kind === 'get-link')).toBe(false);
  });
});