import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Gem2GoScraper } from '@/lib/scrapers/Gem2GoScraper';
import type { ScrapedEvent } from '@/types/events';

// Echte Detailseiten-Ausschnitte (abgerufen 2026-10-07), siehe detail-extract/__tests__/fixtures.
const FIX = path.join(__dirname, '..', '..', '..', 'lib', 'scrapers', 'detail-extract', '__tests__', 'fixtures', 'gem2go');
const page = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8');

type Internals = {
  fetchWithTimeout(url: string, ms: number): Promise<string | null>;
  sleep(ms: number): Promise<void>;
  enrichEventsFromDetailPages(events: ScrapedEvent[], placeholderLocation: string): Promise<void>;
};

function scraper(pages: Record<string, string>) {
  const s = new Gem2GoScraper() as unknown as Internals;
  const fetched: string[] = [];
  s.fetchWithTimeout = async (url) => {
    fetched.push(url);
    return pages[url] ?? null;
  };
  s.sleep = async () => {};
  return { s, fetched };
}

const ev = (source_id: string, source_url: string, location_name: string) =>
  ({ source_id, source_name: 'gem2go', source_url, title: 'Test', start_date: '2026-11-01', location_name }) as ScrapedEvent;

describe('Gem2GoScraper Detailabruf', () => {
  it('ruft eine Detailseite, die sich Serientermine teilen, nur einmal ab', async () => {
    const url = 'https://www.andorf.at/50_Jahre_-_Andorfer_Choere_-_Jubilaeumskonzert';
    const { s, fetched } = scraper({ [url]: page('andorf-sporthalle.html') });
    const events = [ev('a-2026-11-01', url, 'Andorf'), ev('a-2026-11-08', url, 'Andorf')];
    await s.enrichEventsFromDetailPages(events, 'Andorf');
    expect(fetched).toEqual([url]);
    for (const e of events) expect(e).toMatchObject({ location_name: 'Sporthalle Andorf', address: 'Hans-Holz-Straße 1', postal_code: '4770' });
  });

  it('verwirft eine gespeicherte Adresse, wenn die gelesene Detailseite keine nennt', async () => {
    // Pram nennt keinen Ort; früher kam "Marktstraße 1" (Gemeindeamt) aus der Fußzeile.
    // Der Schreibpfad behält ohne Markierung den alten Wert (address_rejected, source-coords-policy).
    const url = 'https://www.pram.at/system/web/veranstaltung.aspx?detailonr=228563044&sprache=1&menuonr=223812352';
    const { s } = scraper({ [url]: page('pram-buchausstellung.html') });
    const ohne = ev('p', url, 'Pram');
    const mitListenAdresse = { ...ev('r', url, 'Pram'), address: 'Kirchenplatz 2' };
    await s.enrichEventsFromDetailPages([ohne, mitListenAdresse], 'Pram');
    expect(ohne).toMatchObject({ address_rejected: 'page_boilerplate' });
    expect(ohne.address).toBeUndefined();
    expect(mitListenAdresse.address_rejected).toBeUndefined();
    expect(mitListenAdresse.address).toBe('Kirchenplatz 2');
  });

  it('lässt die Adresse unberührt, wenn die Detailseite nicht abrufbar war', async () => {
    const { s } = scraper({});
    const e = ev('x', 'https://www.pram.at/Weg_1', 'Pram');
    await s.enrichEventsFromDetailPages([e], 'Pram');
    expect(e.address_rejected).toBeUndefined();
  });

  it('ersetzt den Gemeindenamen als Platzhalter auch durch einen kürzeren Ort', async () => {
    // Vorher gewann nur ein längerer Ort: "Kirchenvorplatz" hätte "Neustift im Mühlkreis" nie ersetzt.
    const url = 'http://www.moosbrunn.gv.at/Punschstand_nach_der_Abendmesse';
    const { s } = scraper({ [url]: page('moosbrunn-punschstand.html') });
    const placeholder = ev('m', url, 'Neustift im Mühlkreis');
    const venue = ev('v', url, 'Gasthaus zur Post Neustift');
    await s.enrichEventsFromDetailPages([placeholder, venue], 'Neustift im Mühlkreis');
    expect(placeholder.location_name).toBe('Kirchenvorplatz');
    // Ein echter Ort aus der Liste bleibt, wenn er länger ist (bisherige Regel).
    expect(venue.location_name).toBe('Gasthaus zur Post Neustift');
  });
});
