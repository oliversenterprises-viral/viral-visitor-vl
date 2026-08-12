import { describe, expect, it } from 'vitest';
import { liveVersionMatches } from '../../scripts/wait-for-live-version.mjs';

describe('liveVersionMatches', () => {
  const sha = '29b5f3a3e9f471e98e84f14c92d54c9ac1fc68b2';

  it('matches short version and full commit', () => {
    expect(
      liveVersionMatches(sha, { version: '29b5f3a', commit: sha }),
    ).toBe(true);
  });

  it('rejects a different deploy', () => {
    expect(
      liveVersionMatches(sha, { version: '862fb4a', commit: '862fb4aaaf86679155fb34d7deb29cf64d8c96f1' }),
    ).toBe(false);
  });

  it('rejects missing payload', () => {
    expect(liveVersionMatches(sha, null)).toBe(false);
    expect(liveVersionMatches('', { version: '29b5f3a' })).toBe(false);
  });
});
