import { describe, it, expect } from 'vitest';
import {
  TRUST_COPY_EXTERNAL,
  TRUST_COPY_REDIRECT,
  BANNED_STRINGS,
  providerLine,
} from '@/lib/v4/event-detail-trust-copy';

describe('event-detail-trust-copy', () => {
  it('TRUST_COPY_EXTERNAL is exactly the brief-approved string', () => {
    expect(TRUST_COPY_EXTERNAL).toBe('Kauf und Zahlung erfolgen beim offiziellen Anbieter.');
  });

  it('TRUST_COPY_REDIRECT is exactly the brief-approved string', () => {
    expect(TRUST_COPY_REDIRECT).toBe('Du wirst zum offiziellen Ticketshop weitergeleitet.');
  });

  it('BANNED_STRINGS contains the four hard-banned phrases', () => {
    expect(BANNED_STRINGS).toContain('Kein Aufpreis');
    expect(BANNED_STRINGS).toContain('Personalisierte e-Tickets');
    expect(BANNED_STRINGS).toContain('Boardkarte');
    expect(BANNED_STRINGS).toContain('Bei ÖBB buchen');
  });

  it('providerLine formats as "Offizieller Ticketshop: <name>"', () => {
    expect(providerLine('Eventim')).toBe('Offizieller Ticketshop: Eventim');
    expect(providerLine('oeticket')).toBe('Offizieller Ticketshop: oeticket');
  });

  it('providerLine falls back to a generic phrase when name is null/empty', () => {
    expect(providerLine(null)).toBe('Offizieller Ticketshop');
    expect(providerLine('')).toBe('Offizieller Ticketshop');
  });
});
