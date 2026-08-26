/**
 * normalizeTicketUrl — schützt die Affiliate-Einnahmen im einzigen
 * Write-Pfad Scraper→Supabase.
 *
 * Hintergrund: oeticket.com ist Eventim Austria. Aggregator-Scraper liefern
 * deren Deeplinks mit FREMDER Partner-ID mit (eventfinder.at: H51). Da
 * V4SideBox die TicketBox für jeden gesetzten ticketUrl rendert, stand
 * dadurch ein Ticket-Button auf unseren Seiten, dessen Provision an einen
 * Mitbewerber ging (Befund 2026-08-26: 520 kommende Events betroffen).
 */
import { describe, it, expect } from 'vitest';
import { normalizeTicketUrl, EVENTIM_AFFILIATE_ID } from '@/lib/db/supabase-sync';

describe('normalizeTicketUrl', () => {
  it('ersetzt eine fremde Affiliate-ID durch unsere', () => {
    const fremd =
      'https://www.oeticket.com/noapp/event/58erl-in-ehrn-arena-wien-20095410/?affiliate=H51';
    const out = normalizeTicketUrl(fremd);
    expect(out).toContain(`affiliate=${EVENTIM_AFFILIATE_ID}`);
    expect(out).not.toContain('H51');
  });

  it('ergänzt die ID, wenn gar kein affiliate-Parameter gesetzt ist', () => {
    const ohne = 'https://www.oeticket.com/noapp/event/irgendwas-12345678/';
    expect(normalizeTicketUrl(ohne)).toBe(
      `https://www.oeticket.com/noapp/event/irgendwas-12345678/?affiliate=${EVENTIM_AFFILIATE_ID}`,
    );
  });

  it('lässt einen bereits korrekten Feed-Deeplink unverändert', () => {
    const korrekt =
      'https://www.oeticket.com/noapp/event/1-pflegesymposium-klinik-maria-theresia-21415810/?affiliate=J70';
    expect(normalizeTicketUrl(korrekt)).toBe(korrekt);
  });

  it('greift auch ohne www-Subdomain', () => {
    expect(normalizeTicketUrl('https://oeticket.com/event/x/?affiliate=H51')).toContain(
      `affiliate=${EVENTIM_AFFILIATE_ID}`,
    );
  });

  it('fasst fremde Ticketanbieter nicht an', () => {
    const fremdanbieter = 'https://www.eventfrog.at/de/p/konzert-123.html';
    expect(normalizeTicketUrl(fremdanbieter)).toBe(fremdanbieter);
  });

  it('lässt Hosts in Ruhe, die oeticket.com nur als Teilstring enthalten', () => {
    const fake = 'https://oeticket.com.example.org/event/x?affiliate=H51';
    expect(normalizeTicketUrl(fake)).toBe(fake);
  });

  it('reicht null, undefined und unparsbare Werte durch', () => {
    expect(normalizeTicketUrl(null)).toBeNull();
    expect(normalizeTicketUrl(undefined)).toBeNull();
    expect(normalizeTicketUrl('')).toBeNull();
    expect(normalizeTicketUrl('kein-link')).toBe('kein-link');
  });
});
