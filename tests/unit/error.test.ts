import { describe, it, expect } from 'vitest';
import { formatError } from '../../src/lib/error';

describe('formatError', () => {
  it('returns the message for Error instances', () => {
    const err = new Error('Something went wrong');
    expect(formatError(err)).toBe('Something went wrong');
  });

  it('returns the string as-is for string inputs', () => {
    expect(formatError('Direct string error')).toBe('Direct string error');
  });

  it('extracts message from objects with a message property', () => {
    const err = { message: 'Object with message' };
    expect(formatError(err)).toBe('Object with message');
  });

  it('returns "Unknown error" for null or undefined', () => {
    expect(formatError(null)).toBe('Unknown error');
    expect(formatError(undefined)).toBe('Unknown error');
  });

  it('returns "Unknown error" for numbers and other primitives', () => {
    expect(formatError(42)).toBe('Unknown error');
    expect(formatError(true)).toBe('Unknown error');
  });
});
