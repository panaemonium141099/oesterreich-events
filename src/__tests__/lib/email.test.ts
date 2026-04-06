import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderArtistAlertEmail } from '../../emails/artist-alert';
import { renderArtistReminderEmail } from '../../emails/artist-reminder';
import type { ArtistAlertEmailData, ArtistReminderEmailData } from '../../lib/email';

// ── Shared test data ────────────────────────────────────────────────────────

const baseData: ArtistAlertEmailData = {
  artistName: 'Wanda',
  artistImageUrl: 'https://example.com/wanda.jpg',
  eventTitle: 'Wanda Live in Wien',
  eventDate: '15. Mai 2026',
  eventTime: '20:00',
  venueName: 'Wiener Stadthalle',
  location: 'Wien',
  ticketUrl: 'https://tickets.example.com/wanda',
  eventPageUrl: 'https://osterreich.events/events/abc-123',
  unsubscribeUrl: 'https://osterreich.events/api/notifications/unsubscribe?user_id=u1&token=tok',
  preferencesUrl: 'https://osterreich.events/settings/notifications',
};

// ── Artist Alert Email ──────────────────────────────────────────────────────

describe('renderArtistAlertEmail', () => {
  it('renders an HTML email with artist name and event title', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('Wanda');
    expect(html).toContain('Wanda Live in Wien');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('uses ticket URL as primary CTA when available', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('https://tickets.example.com/wanda');
    expect(html).toContain('Tickets sichern');
  });

  it('falls back to event page URL when no ticket URL', () => {
    const data = { ...baseData, ticketUrl: null };
    const html = renderArtistAlertEmail(data);
    expect(html).not.toContain('Tickets sichern');
    expect(html).toContain('Event-Details ansehen');
    expect(html).toContain('https://osterreich.events/events/abc-123');
  });

  it('shows secondary "Event-Details ansehen" link when ticket URL exists', () => {
    const html = renderArtistAlertEmail(baseData);
    // Primary CTA is "Tickets sichern", secondary link is "Event-Details ansehen"
    const matches = html.match(/Event-Details ansehen/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('includes event date, time, venue, and location', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('15. Mai 2026');
    expect(html).toContain('20:00');
    expect(html).toContain('Wiener Stadthalle');
    expect(html).toContain('Wien');
  });

  it('includes unsubscribe link in footer', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('E-Mail-Benachrichtigungen abbestellen');
    // URL & is escaped to &amp; in HTML
    expect(html).toContain('user_id=u1&amp;token=tok');
  });

  it('includes preferences link in footer', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('Benachrichtigungen verwalten');
    expect(html).toContain(baseData.preferencesUrl);
  });

  it('renders artist initial fallback when no image URL', () => {
    const data = { ...baseData, artistImageUrl: null };
    const html = renderArtistAlertEmail(data);
    expect(html).not.toContain('<img');
    expect(html).toContain('W'); // first letter of "Wanda"
  });

  it('renders artist image when image URL provided', () => {
    const html = renderArtistAlertEmail(baseData);
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/wanda.jpg');
  });

  it('omits time row when eventTime is null', () => {
    const data = { ...baseData, eventTime: null };
    const html = renderArtistAlertEmail(data);
    expect(html).not.toContain('Uhr');
  });

  it('omits venue row when venueName is null', () => {
    const data = { ...baseData, venueName: null };
    const html = renderArtistAlertEmail(data);
    expect(html).not.toContain('Wiener Stadthalle');
  });

  it('escapes HTML in artist name', () => {
    const data = { ...baseData, artistName: '<script>alert("xss")</script>' };
    const html = renderArtistAlertEmail(data);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ── Artist Reminder Email ───────────────────────────────────────────────────

describe('renderArtistReminderEmail', () => {
  const reminderData7d: ArtistReminderEmailData = {
    ...baseData,
    daysUntil: 7,
  };

  const reminderData1d: ArtistReminderEmailData = {
    ...baseData,
    daysUntil: 1,
  };

  it('renders 7-day reminder with correct urgency copy', () => {
    const html = renderArtistReminderEmail(reminderData7d);
    expect(html).toContain('Noch 7 Tage!');
    expect(html).toContain('in 7 Tagen');
    expect(html).toContain('Sichere dir jetzt deine Tickets');
  });

  it('renders 1-day reminder with urgency header', () => {
    const html = renderArtistReminderEmail(reminderData1d);
    expect(html).toContain('Morgen ist es soweit!');
    expect(html).toContain('morgen');
  });

  it('uses red urgency banner for 1-day reminder', () => {
    const html = renderArtistReminderEmail(reminderData1d);
    expect(html).toContain('#dc2626'); // red
  });

  it('uses amber urgency banner for 7-day reminder', () => {
    const html = renderArtistReminderEmail(reminderData7d);
    expect(html).toContain('#f59e0b'); // amber
  });

  it('uses "Letzte Chance" CTA text for 1-day with ticket URL', () => {
    const html = renderArtistReminderEmail(reminderData1d);
    expect(html).toContain('Letzte Chance');
    expect(html).toContain('Tickets sichern');
  });

  it('falls back to event page text for 1-day without ticket URL', () => {
    const data = { ...reminderData1d, ticketUrl: null };
    const html = renderArtistReminderEmail(data);
    expect(html).toContain('Letzte Chance');
    expect(html).toContain('Event ansehen');
  });

  it('includes unsubscribe link in footer', () => {
    const html = renderArtistReminderEmail(reminderData7d);
    expect(html).toContain('E-Mail-Benachrichtigungen abbestellen');
    // URL & is escaped to &amp; in HTML
    expect(html).toContain('user_id=u1&amp;token=tok');
  });
});

// ── Unsubscribe token ───────────────────────────────────────────────────────

describe('unsubscribe token', () => {
  it('generates and verifies a valid token', async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import('../../lib/email');
    const userId = 'test-user-123';
    const secret = 'test-secret-key';

    const token = await generateUnsubscribeToken(userId, secret);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    // URL-safe: no +, /, or =
    expect(token).not.toMatch(/[+/=]/);

    const valid = await verifyUnsubscribeToken(userId, token, secret);
    expect(valid).toBe(true);
  });

  it('rejects token with wrong user ID', async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import('../../lib/email');
    const secret = 'test-secret-key';

    const token = await generateUnsubscribeToken('user-1', secret);
    const valid = await verifyUnsubscribeToken('user-2', token, secret);
    expect(valid).toBe(false);
  });

  it('rejects token with wrong secret', async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import('../../lib/email');
    const userId = 'test-user-123';

    const token = await generateUnsubscribeToken(userId, 'secret-a');
    const valid = await verifyUnsubscribeToken(userId, token, 'secret-b');
    expect(valid).toBe(false);
  });

  it('generates deterministic tokens for same inputs', async () => {
    const { generateUnsubscribeToken } = await import('../../lib/email');
    const userId = 'test-user-123';
    const secret = 'test-secret-key';

    const token1 = await generateUnsubscribeToken(userId, secret);
    const token2 = await generateUnsubscribeToken(userId, secret);
    expect(token1).toBe(token2);
  });
});

// ── Resend API integration ──────────────────────────────────────────────────

describe('sendArtistAlertEmail', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('returns "failed" when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendArtistAlertEmail } = await import('../../lib/email');
    const result = await sendArtistAlertEmail('test@example.com', baseData);
    expect(result).toBe('failed');
  });

  it('returns "sent" on successful API call', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-123' }),
    });

    // Force re-import to pick up new env
    const mod = await import('../../lib/email');
    const result = await mod.sendArtistAlertEmail('test@example.com', baseData);
    expect(result).toBe('sent');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-resend-key',
        }),
      })
    );
  });

  it('returns "failed" on 400 client error (no retry)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });

    const mod = await import('../../lib/email');
    const result = await mod.sendArtistAlertEmail('test@example.com', baseData);
    expect(result).toBe('failed');

    // Should NOT retry on 4xx (except 429)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 server error up to 3 times', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    const mod = await import('../../lib/email');
    const result = await mod.sendArtistAlertEmail('test@example.com', baseData);
    expect(result).toBe('failed');

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});
