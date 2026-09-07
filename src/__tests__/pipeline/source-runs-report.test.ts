/**
 * Der Bericht des naechtlichen Laufs muss die Scraper-Zahlen zeigen.
 *
 * Der Workflow scrapt in eigenen Shard-Jobs und ruft `scrape-pipeline.ts`
 * danach mit `--skip-scrapers` auf — dieser zweite Lauf schreibt den
 * Bericht, hatte aber selbst keinen Scraper laufen lassen. Der Bericht vom
 * 2026-09-07 meldete deshalb "Erfolgreich · 0 Events gefunden, 0
 * aktualisiert · Dauer 0 s", waehrend die Shards 144 Scraper gefahren,
 * 69.966 Events gefunden und 4.801 Zeilen an einem FK-Fehler verloren
 * hatten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rows = [
  { source_name: 'feratel-deskline', run_at: '2026-09-07T06:20:00Z', status: 'success', events_found: 10263, events_upserted: 10013, duration_ms: 60000, error_message: null },
  { source_name: 'meinbezirk', run_at: '2026-09-07T06:30:00Z', status: 'error', events_found: 3701, events_upserted: 1, duration_ms: 90000, error_message: '3700 Zeilen nicht geschrieben: events_district_fkey' },
  { source_name: 'events.at', run_at: '2026-09-07T06:40:00Z', status: 'timeout', events_found: 0, events_upserted: 0, duration_ms: 1500000, error_message: 'timed out nach 25 min' },
  // Aelterer Lauf derselben Quelle — der juengste muss gewinnen.
  { source_name: 'meinbezirk', run_at: '2026-09-07T04:00:00Z', status: 'success', events_found: 10, events_upserted: 10, duration_ms: 100, error_message: null },
];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        gte: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [...rows].sort((a, b) => a.run_at.localeCompare(b.run_at)), error: null }),
          }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});
afterEach(() => vi.resetModules());

describe('loadScraperResultsFromSourceRuns', () => {
  it('baut die Scraper-Bilanz aus source_runs', async () => {
    const { loadScraperResultsFromSourceRuns } = await import('@/lib/scrape-reporter');
    const res = await loadScraperResultsFromSourceRuns();

    // Drei Quellen, nicht vier — meinbezirk kommt nur einmal vor.
    expect(res).toHaveLength(3);

    const byName = Object.fromEntries(res.map(r => [r.scraper_name, r]));
    expect(byName['feratel-deskline'].status).toBe('success');
    expect(byName['feratel-deskline'].events_found).toBe(10263);

    // Der juengste Lauf gewinnt: der Fehler von 06:30, nicht der Erfolg von 04:00.
    expect(byName['meinbezirk'].status).toBe('failed');
    expect(byName['meinbezirk'].events_found).toBe(3701);
    expect(byName['meinbezirk'].error_message).toContain('events_district_fkey');

    // 'timeout' ist im Bericht schlicht ein gescheiterter Scraper.
    expect(byName['events.at'].status).toBe('failed');

    const found = res.reduce((n, r) => n + r.events_found, 0);
    expect(found).toBe(10263 + 3701 + 0);
    expect(res.filter(r => r.status !== 'success')).toHaveLength(2);
  });
});
