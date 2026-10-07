/**
 * Ticketmaster-Uhrzeit: Discovery-API-Wandzeit muss als Wiener Zeit ankommen.
 *
 * Befund 2026-10-07: Ticketmaster-Zeilen standen gegenüber Eventim um den
 * Wiener Offset zu spät (Fink 22:00 statt 20:00, Kodaline 21:00 statt
 * 20:00). Der Scraper gibt `localDate` + `localTime` als nackte Wandzeit
 * aus; seit PR #190 rechnet der Schreibpfad (`normalizeEventTimestamps`)
 * sie nach UTC um. Die falschen Zeilen sind Altbestand von davor (zuletzt
 * gesehen 2026-05-06, alte numerische source_ids). Dieser Test hält den
 * heutigen Pfad Scraper → Schreibpfad mit beiden echten Fällen fest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TicketmasterScraper } from '@/lib/scrapers/TicketmasterScraper';
import { normalizeEventTimestamps } from '@/lib/db/supabase-sync';

function tmEvent(id: string, name: string, localDate: string, localTime: string) {
  return {
    id,
    name,
    url: `https://www.ticketmaster.at/event/${id}`,
    dates: { start: { localDate, localTime } },
    _embedded: {
      venues: [{
        name: 'Raiffeisen Halle im Gasometer',
        city: { name: 'Wien' },
        address: { line1: 'Guglgasse 8' },
        postalCode: '1110',
        location: { latitude: '48.1852739', longitude: '16.4192438' },
      }],
    },
  };
}

async function scrapeAndNormalize(events: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ page: { totalPages: 1 }, _embedded: { events } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )));
  const scraper = new TicketmasterScraper();
  vi.spyOn(scraper as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue();
  return normalizeEventTimestamps(await scraper.scrape());
}

describe('Ticketmaster-Uhrzeit', () => {
  beforeEach(() => {
    vi.stubEnv('TICKETMASTER_API_KEY', 'test-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('Sommerzeit: Fink 20:00 Wien wird 18:00 UTC', async () => {
    const [out] = await scrapeAndNormalize([
      tmEvent('Z698xZ2qZa7Fk', 'Fink - Europe Tour 2026', '2026-10-20', '20:00:00'),
    ]);
    expect(out.start_date).toBe('2026-10-20T18:00:00.000Z');
  });

  it('Winterzeit: Kodaline 20:00 Wien wird 19:00 UTC', async () => {
    const [out] = await scrapeAndNormalize([
      tmEvent('Z698xZ2qZa7Fq', 'Kodaline - Farewell Tour', '2026-12-06', '20:00:00'),
    ]);
    expect(out.start_date).toBe('2026-12-06T19:00:00.000Z');
  });

  it('Upsert-Identität enthält keine Uhrzeit', async () => {
    const [out] = await scrapeAndNormalize([
      tmEvent('Z698xZ2qZa7Fk', 'Fink - Europe Tour 2026', '2026-10-20', '20:00:00'),
    ]);
    expect(out.source_id).toBe('ticketmaster-Z698xZ2qZa7Fk');
  });
});
