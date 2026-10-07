/**
 * Ein Scraper ohne Pflicht-Konfiguration ist kein Lauf.
 *
 * Befund 2026-10-07: ticketmaster lief ohne API-Key täglich in 1 ms mit
 * 0 Treffern und stand als `success` in source_runs. Der Rückzug
 * (withdrawal.ts, Regel B) hielt die Quelle deshalb für "läuft, findet
 * nichts", verlangte einen Detailseiten-Beleg, bekam von ticketmaster.at
 * 401 und ließ 39 Altzeilen mit falscher Uhrzeit stehen. Ohne
 * source_runs-Eintrag gilt die Quelle als abgeschaltet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.fn(async () => ({ error: null }));
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient: vi.fn(() => ({ from: () => ({ insert }) })),
}));

import { runScraper } from '@/lib/scrapers';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import { TicketmasterScraper } from '@/lib/scrapers/TicketmasterScraper';
import type { ScrapedEvent } from '@/types/events';

class FakeScraper extends BaseScraper {
  readonly name = 'fake-source';
  constructor(private readonly missing: string | null) { super(); }
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  missingConfig() { return this.missing; }
}

describe('runScraper: übersprungen ist kein Lauf', () => {
  beforeEach(() => {
    insert.mockClear();
    vi.stubEnv('SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('schreibt ohne Konfiguration keinen source_runs-Eintrag und scrapt nicht', async () => {
    const scraper = new FakeScraper('FAKE_API_KEY nicht gesetzt');
    const scrape = vi.spyOn(scraper, 'scrape');
    const result = await runScraper(scraper);
    expect(scrape).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(result).toEqual({ eventsFound: 0, eventsUpserted: 0, durationMs: 0 });
  });

  it('schreibt mit Konfiguration weiter einen Lauf, auch bei 0 Treffern', async () => {
    const scraper = new FakeScraper(null);
    const scrape = vi.spyOn(scraper, 'scrape');
    await runScraper(scraper);
    expect(scrape).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      source_name: 'fake-source', events_found: 0, status: 'success',
    }));
  });

  it('Ticketmaster meldet den fehlenden Key', () => {
    vi.stubEnv('TICKETMASTER_API_KEY', '');
    expect(new TicketmasterScraper().missingConfig()).toBe('TICKETMASTER_API_KEY nicht gesetzt');
    vi.stubEnv('TICKETMASTER_API_KEY', 'key');
    expect(new TicketmasterScraper().missingConfig()).toBeNull();
  });
});
