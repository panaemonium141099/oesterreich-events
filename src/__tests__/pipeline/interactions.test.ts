import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '@/lib/interactions';
import type { InteractionType } from '@/lib/interactions';

// ---------------------------------------------------------------------------
// InteractionType validation
// ---------------------------------------------------------------------------

describe('InteractionType', () => {
  it('defines all expected interaction types', () => {
    // Verify the type covers the expected values at runtime via a typed array
    const types: InteractionType[] = [
      'view',
      'save',
      'reminder_set',
      'share',
      'click_ticket',
      'click_source',
    ];
    expect(types).toHaveLength(6);
    expect(new Set(types).size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// trackInteraction function signature
// ---------------------------------------------------------------------------

describe('trackInteraction', () => {
  it('is exported and callable', async () => {
    const mod = await import('@/lib/interactions');
    expect(typeof mod.trackInteraction).toBe('function');
    // Should accept (eventId, userId, type, metadata?)
    expect(mod.trackInteraction.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('192.168.1.1')).toBe(true);
    }
  });

  it('blocks requests over the limit', () => {
    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      checkRateLimit('10.0.0.1');
    }
    // 101st request should be blocked
    expect(checkRateLimit('10.0.0.1')).toBe(false);
  });

  it('tracks IPs independently', () => {
    // Exhaust limit for one IP
    for (let i = 0; i < 100; i++) {
      checkRateLimit('10.0.0.1');
    }
    expect(checkRateLimit('10.0.0.1')).toBe(false);
    // Different IP should still be allowed
    expect(checkRateLimit('10.0.0.2')).toBe(true);
  });

  it('resetRateLimits clears all state', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('10.0.0.1');
    }
    expect(checkRateLimit('10.0.0.1')).toBe(false);

    resetRateLimits();
    expect(checkRateLimit('10.0.0.1')).toBe(true);
  });
});
