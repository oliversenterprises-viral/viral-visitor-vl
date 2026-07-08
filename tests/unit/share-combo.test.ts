import { describe, it, expect, beforeEach } from 'vitest';
import {
  getShareComboCount,
  recordShareCombo,
  shareComboLabel,
} from '../../src/lib/share-combo';

describe('share-combo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts combo at 1', () => {
    const r = recordShareCombo(1000);
    expect(r.combo).toBe(1);
    expect(shareComboLabel(1)).toBe('');
  });

  it('stacks combo within window', () => {
    const t = Date.now();
    recordShareCombo(t);
    const r = recordShareCombo(t + 30_000);
    expect(r.combo).toBe(2);
    expect(shareComboLabel(2)).toMatch(/2x combo/i);
    expect(getShareComboCount()).toBe(2);
  });

  it('resets combo after window expires', () => {
    recordShareCombo(1000);
    recordShareCombo(2000);
    const r = recordShareCombo(6 * 60 * 1000);
    expect(r.combo).toBe(1);
  });
});