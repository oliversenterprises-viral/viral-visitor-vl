import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultShareAbVariant,
  resolveShareAbVariant,
  setStoredShareAbVariant,
  getShareAbTemplate,
  SHARE_AB_TEMPLATES,
} from '../../src/lib/share-ab';

describe('share-ab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaultShareAbVariant is stable per code', () => {
    const a = defaultShareAbVariant('VIRAL-STABLE1');
    const b = defaultShareAbVariant('VIRAL-STABLE1');
    expect(a).toBe(b);
    expect(['a', 'b']).toContain(a);
  });

  it('resolveShareAbVariant prefers stored override', () => {
    setStoredShareAbVariant('b');
    expect(resolveShareAbVariant('VIRAL-ANY')).toBe('b');
  });

  it('templates include link placeholder', () => {
    expect(getShareAbTemplate('a')).toBe(SHARE_AB_TEMPLATES.a);
    expect(SHARE_AB_TEMPLATES.a).toContain('{link}');
    expect(SHARE_AB_TEMPLATES.b).toContain('{link}');
  });
});