import { describe, expect, it } from 'vitest';
import {
  duelInviteHeadline,
  duelInviteSubline,
} from '../../src/lib/duel-invite';

describe('duel-invite', () => {
  it('formats headline with rival code', () => {
    expect(duelInviteHeadline('VIRAL-RIVAL')).toContain('VIRAL-RIVAL');
    expect(duelInviteHeadline('VIRAL-RIVAL')).toContain('Challenge');
  });

  it('formats subline for duel links', () => {
    expect(duelInviteSubline('VIRAL-RIVAL')).toMatch(/stats|WhatsApp/i);
    expect(duelInviteSubline(null)).toContain('challenge=1');
  });
});