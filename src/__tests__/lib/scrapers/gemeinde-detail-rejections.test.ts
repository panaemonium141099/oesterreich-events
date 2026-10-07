/**
 * Die drei Gemeinde-Scraper lesen Detailseiten mit demselben Extraktor
 * (gem2go-Adapter). Seit PR #287 nimmt er keine Gemeindeamt-Adresse aus der
 * Fußzeile und kein "frei" neben einem Betrag mehr. Gespeicherte Altwerte
 * hält der Preis- bzw. Adress-Schutz im Schreibpfad aber fest, solange die
 * Quelle nichts Neues liefert. Deshalb melden die Scraper die Ablehnung
 * (address_rejected / price_rejected), wenn die gelesene Seite Event-Inhalt
 * hat, aber keine Adresse bzw. keinen eindeutigen Preis.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { Gem2GoScraper } from '@/lib/scrapers/Gem2GoScraper';
import { GemeindeRegistryScraper } from '@/lib/scrapers/GemeindeRegistryScraper';
import { GenericGemeindeScraper } from '@/lib/scrapers/GenericGemeindeScraper';
import type { ScrapedEvent } from '@/types/events';

// Echter Ausschnitt (Pram, abgerufen 2026-10-07): JSON-LD mit Beschreibung,
// kein Ortsblock, Gemeindeamt "Marktstraße 1" in #footer.
const PRAM = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'lib', 'scrapers', 'detail-extract', '__tests__', 'fixtures', 'gem2go', 'pram-buchausstellung.html'),
  'utf8',
);
const withoutContent = (() => {
  const $ = cheerio.load(PRAM);
  $('script[type="application/ld+json"], h1').remove();
  return $.html();
})();
const withDescription = (text: string) => PRAM.replace('Buchausstellung im Pfarrheim Pram', text);
const OKTOBERFEST = 'Maß Bier nur 9,90 € Mit Dirndl oder Lederhose gibt’s a gratis Schnapserl!';

const URL = 'https://www.pram.at/Buchausstellung_1';
const LISTING = 'https://www.pram.at/system/web/veranstaltung.aspx?sprache=1';
const ev = (extra: Partial<ScrapedEvent> = {}) =>
  ({ source_id: 'x', source_name: 'gem2go', source_url: URL, title: 'T', start_date: '2026-11-01', location_name: 'Pram', ...extra }) as ScrapedEvent;

type Run = (events: ScrapedEvent[], html: string) => Promise<void>;
const scrapers: Array<[string, Run]> = [
  ['gem2go', async (events, html) => {
    const s = new Gem2GoScraper() as unknown as Record<string, unknown> & { enrichEventsFromDetailPages(e: ScrapedEvent[], p: string): Promise<void> };
    s.fetchWithTimeout = async () => html;
    s.sleep = async () => {};
    await s.enrichEventsFromDetailPages(events, 'Pram');
  }],
  ['gemeinde-registry', async (events, html) => {
    const s = new GemeindeRegistryScraper() as unknown as Record<string, unknown> & { enrichEventsFromDetailPages(e: ScrapedEvent[], l: string): Promise<void> };
    s.fetchWithTimeout = async () => ({ html });
    s.sleep = async () => {};
    await s.enrichEventsFromDetailPages(events, LISTING);
  }],
  ['gemeinden-generic', async (events, html) => {
    const s = new GenericGemeindeScraper() as unknown as Record<string, unknown> & { enrichEventsFromDetailPages(e: ScrapedEvent[], l: string): Promise<void> };
    s.fetchPageSafe = async () => html;
    await s.enrichEventsFromDetailPages(events, LISTING);
  }],
];

describe.each(scrapers)('%s: Ablehnung gespeicherter Altwerte', (_name, run) => {
  it('verwirft die Adresse, wenn die gelesene Seite Inhalt, aber keine Adresse hat', async () => {
    const e = ev();
    await run([e], PRAM);
    expect(e.address).toBeUndefined();
    expect(e.address_rejected).toBe('page_boilerplate');
  });

  it('verwirft nichts, wenn die Seite keinen Event-Inhalt hat (Weiterleitung, Fehlerseite)', async () => {
    const e = ev();
    await run([e], withoutContent);
    expect(e.address_rejected).toBeUndefined();
  });

  it('behält eine Adresse aus der Liste', async () => {
    const e = ev({ address: 'Kirchenplatz 2' });
    await run([e], PRAM);
    expect(e).toMatchObject({ address: 'Kirchenplatz 2' });
    expect(e.address_rejected).toBeUndefined();
  });

  it('meldet einen unklaren Gratis-Hinweis als price_rejected, außer die Liste hat einen Preis', async () => {
    const ohne = ev();
    const mitPreis = ev({ source_id: 'y', price_text: '€ 5,–', price_min: 5 });
    await run([ohne, mitPreis], withDescription(OKTOBERFEST));
    expect(ohne.price_rejected).toBe('unclear_free');
    expect(ohne.price_text).toBeUndefined();
    expect(mitPreis.price_rejected).toBeUndefined();
  });
});
