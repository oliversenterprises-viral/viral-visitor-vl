import { describe, expect, it } from 'vitest';
import { isRelayPathname } from '../../src/lib/relay-mode';
import { normalizeRelayUrlInput } from '../../src/lib/relay-client';

describe('relay-mode', () => {
  it('matches /relay and /traffic', () => {
    expect(isRelayPathname('/relay')).toBe(true);
    expect(isRelayPathname('/relay/')).toBe(true);
    expect(isRelayPathname('/traffic')).toBe(true);
    expect(isRelayPathname('/Traffic')).toBe(true);
    expect(isRelayPathname('/')).toBe(false);
    expect(isRelayPathname('/embed')).toBe(false);
    expect(isRelayPathname('/relay/extra')).toBe(false);
  });
});

describe('normalizeRelayUrlInput', () => {
  it('adds https when missing', () => {
    expect(normalizeRelayUrlInput('example.org/path')).toBe('https://example.org/path');
  });

  it('keeps existing protocol', () => {
    expect(normalizeRelayUrlInput('http://foo.test')).toBe('http://foo.test');
    expect(normalizeRelayUrlInput('https://foo.test')).toBe('https://foo.test');
  });

  it('trims whitespace', () => {
    expect(normalizeRelayUrlInput('  https://a.com  ')).toBe('https://a.com');
  });
});
