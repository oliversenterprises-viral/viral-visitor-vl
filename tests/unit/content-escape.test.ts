import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/content';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('coerces non-strings safely', () => {
    expect(escapeHtml(String(null))).toBe('null');
  });
});