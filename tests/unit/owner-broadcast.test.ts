import { describe, it, expect } from 'vitest';
import { broadcastMessageId, parseOwnerBroadcast } from '../../src/lib/owner-broadcast';

describe('owner-broadcast', () => {
  it('returns null when disabled or empty body', () => {
    expect(parseOwnerBroadcast(null)).toBeNull();
    expect(parseOwnerBroadcast({})).toBeNull();
    expect(
      parseOwnerBroadcast({
        owner_broadcast_enabled: '1',
        owner_broadcast_body: '   ',
      }),
    ).toBeNull();
    expect(
      parseOwnerBroadcast({
        owner_broadcast_enabled: '0',
        owner_broadcast_body: 'Hello',
      }),
    ).toBeNull();
  });

  it('parses enabled broadcast with title and body', () => {
    const msg = parseOwnerBroadcast({
      owner_broadcast_enabled: 'true',
      owner_broadcast_title: 'Rule update',
      owner_broadcast_body: 'You have about 2 days (48h) for 1 friend to Get my link.',
      owner_broadcast_id: 'rules-v1',
    });
    expect(msg).not.toBeNull();
    expect(msg!.enabled).toBe(true);
    expect(msg!.title).toBe('Rule update');
    expect(msg!.body).toContain('48h');
    expect(msg!.id).toBe('rules-v1');
  });

  it('broadcastMessageId uses explicit id or stable hash', () => {
    expect(broadcastMessageId('A', 'B', 'custom')).toBe('custom');
    const a = broadcastMessageId('A', 'B');
    const b = broadcastMessageId('A', 'B');
    expect(a).toBe(b);
    expect(a.startsWith('bc_')).toBe(true);
  });
});
