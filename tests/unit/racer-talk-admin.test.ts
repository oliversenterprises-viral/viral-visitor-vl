import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TalkAdminError,
  isTalkUnavailable,
  parseOwnerListResult,
  parseOwnerSendResult,
  parseOwnerThreadResult,
} from '../../src/lib/racer-talk-admin';
import { TALK_LEAD, TALK_TITLE, renderTalkView } from '../../src/admin/racer-talk-tab';

describe('HQ Talk fail-closed', () => {
  it('Unknown action / missing function cannot look like an empty inbox', () => {
    expect(isTalkUnavailable('Unknown action')).toBe(true);
    expect(isTalkUnavailable('Function not found')).toBe(true);
    expect(() =>
      parseOwnerListResult({ success: false, error: 'Unknown action' }),
    ).toThrow(TalkAdminError);
    expect(() =>
      parseOwnerListResult({ success: false, error: 'Unknown action' }),
    ).toThrow(/racer-talk function is missing/);
    expect(() =>
      parseOwnerThreadResult({ success: false, error: 'Unknown action' }),
    ).toThrow(/Unknown action/);
    expect(() =>
      parseOwnerSendResult({ success: false, error: 'Unknown action' }),
    ).toThrow(/racer-talk function is missing/);
    expect(() => parseOwnerSendResult({ success: true })).not.toThrow();
    expect(
      parseOwnerListResult({
        success: true,
        data: [{ code: 'viral-abc', friends: 2, unread: 1 }],
      }),
    ).toEqual([{ code: 'VIRAL-ABC', friends: 2, unread: 1 }]);
  });

  it('Talk tab copy matches live HQ and switcher registers tab 8', () => {
    expect(TALK_TITLE).toBe('Message verified racers');
    expect(TALK_LEAD).toMatch(/VIRAL- code/);
    const root = document.createElement('div');
    renderTalkView(root, [], '', [], '');
    expect(root.innerHTML).toContain('Message verified racers');
    expect(root.innerHTML).toContain('Pick a racer to talk.');
    expect(root.innerHTML).toContain('No verified racers yet.');

    const switcher = readFileSync(resolve(__dirname, '../../src/admin/switcher.ts'), 'utf8');
    expect(switcher).toContain("tab === 8");
    expect(switcher).toContain('renderRacerTalkTab');
    expect(switcher).not.toContain('reset_landing_visit_counters');
    const tab = readFileSync(resolve(__dirname, '../../src/admin/racer-talk-tab.ts'), 'utf8');
    expect(tab).toContain('data-talk-retry');
    expect(tab).toContain('parseOwnerSendResult');
  });
});
