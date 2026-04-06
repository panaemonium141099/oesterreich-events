import { describe, it, expect } from 'vitest';
import {
  isValidE164,
  isAustrianMobile,
  formatDiscoverySMS,
  formatReminderSMS,
  type ArtistAlertSMSPayload,
  type ArtistReminderSMSPayload,
} from '../../lib/sms';

// ── Phone number validation ──────────────────────────────────────────────────

describe('isValidE164', () => {
  it('accepts valid E.164 numbers', () => {
    expect(isValidE164('+436641234567')).toBe(true);
    expect(isValidE164('+4915112345678')).toBe(true);
    expect(isValidE164('+12025551234')).toBe(true);
  });

  it('rejects numbers without + prefix', () => {
    expect(isValidE164('436641234567')).toBe(false);
  });

  it('rejects numbers starting with +0', () => {
    expect(isValidE164('+0641234567')).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(isValidE164('+12345')).toBe(false);
  });

  it('rejects numbers that are too long', () => {
    expect(isValidE164('+1234567890123456')).toBe(false);
  });

  it('rejects numbers with spaces or dashes', () => {
    expect(isValidE164('+43 664 1234567')).toBe(false);
    expect(isValidE164('+43-664-1234567')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidE164('')).toBe(false);
  });
});

describe('isAustrianMobile', () => {
  it('accepts Austrian mobile numbers', () => {
    expect(isAustrianMobile('+436641234567')).toBe(true);
    expect(isAustrianMobile('+436501234567')).toBe(true);
    expect(isAustrianMobile('+436761234567')).toBe(true);
  });

  it('rejects Austrian landline numbers', () => {
    expect(isAustrianMobile('+4311234567')).toBe(false);
    expect(isAustrianMobile('+43316123456')).toBe(false);
  });

  it('rejects non-Austrian numbers', () => {
    expect(isAustrianMobile('+4915112345678')).toBe(false);
  });
});

// ── SMS formatting ───────────────────────────────────────────────────────────

const basePayload: ArtistAlertSMSPayload = {
  artistName: 'Wanda',
  eventDate: '15. Mai 2026',
  location: 'Wiener Stadthalle, Wien',
  ticketUrl: 'https://tickets.example.com/wanda',
  eventId: 'abc-123',
};

describe('formatDiscoverySMS', () => {
  it('formats a discovery SMS with ticket URL', () => {
    const msg = formatDiscoverySMS(basePayload);
    expect(msg).toContain('Wanda');
    expect(msg).toContain('15. Mai 2026');
    expect(msg).toContain('Wiener Stadthalle');
    expect(msg).toContain('https://tickets.example.com/wanda');
    expect(msg).toContain('Tickets:');
  });

  it('uses event page URL when no ticket URL', () => {
    const msg = formatDiscoverySMS({ ...basePayload, ticketUrl: null });
    expect(msg).toContain('https://osterreich.events/events/abc-123');
  });

  it('stays within 300 chars', () => {
    const longPayload: ArtistAlertSMSPayload = {
      artistName: 'Die Fantastischen Vier',
      eventDate: '25. Dezember 2026',
      location: 'Olympiahalle Innsbruck, Innsbruck, Tirol, Osterreich',
      ticketUrl: 'https://www.very-long-ticket-url.example.com/events/die-fantastischen-vier-innsbruck-2026',
      eventId: 'long-id-123',
    };
    const msg = formatDiscoverySMS(longPayload);
    expect(msg.length).toBeLessThanOrEqual(300);
  });
});

describe('formatReminderSMS', () => {
  const reminderPayload7d: ArtistReminderSMSPayload = {
    ...basePayload,
    reminderType: '7d',
  };

  const reminderPayload1d: ArtistReminderSMSPayload = {
    ...basePayload,
    reminderType: '1d',
  };

  it('formats 7d reminder with "In 1 Woche"', () => {
    const msg = formatReminderSMS(reminderPayload7d);
    expect(msg).toContain('In 1 Woche');
    expect(msg).toContain('Wanda');
    expect(msg).toContain('Tickets:');
  });

  it('formats 1d reminder with "Morgen" and "Letzte Chance"', () => {
    const msg = formatReminderSMS(reminderPayload1d);
    expect(msg).toContain('Morgen');
    expect(msg).toContain('Wanda');
    expect(msg).toContain('Letzte Chance');
  });

  it('stays within 300 chars for both reminder types', () => {
    expect(formatReminderSMS(reminderPayload7d).length).toBeLessThanOrEqual(300);
    expect(formatReminderSMS(reminderPayload1d).length).toBeLessThanOrEqual(300);
  });

  it('uses fallback event URL when no ticket URL', () => {
    const msg = formatReminderSMS({ ...reminderPayload1d, ticketUrl: null });
    expect(msg).toContain('https://osterreich.events/events/abc-123');
  });
});
