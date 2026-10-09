/**
 * Stichprobe 2026-10-09: Ohne lesbares Datum setzte GenericGemeindeScraper
 * (WordPress-/Tribe-Layout) das heutige Datum ein. Die Zeile wanderte jeden
 * Tag weiter und erschien als Event von heute (Klingenbach „Punschstand",
 * eigentlich 23.12.2025). Ohne Datum gibt es kein Event.
 */
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { GenericGemeindeScraper } from '../../lib/scrapers/GenericGemeindeScraper';

const page = {
  gemeinde: { name: 'Klingenbach', website: 'https://www.klingenbach.at', plz: '7013', bezirk: 'Eisenstadt-Umgebung',
    bundesland: 'Burgenland', lat: 47.75, lng: 16.54, idKey: '10303' },
  eventPageUrl: 'https://www.klingenbach.at/veranstaltungen/',
  path: '/veranstaltungen', dateCount: 1, eventKeywords: 1, htmlSize: 1000,
};

function parse(html: string) {
  const scraper = new GenericGemeindeScraper();
  return (scraper as any).parseWordPressEvents(cheerio.load(html), page) as Array<{ title: string; start_date: string }>;
}

describe('GenericGemeindeScraper ohne Datum', () => {
  it('WP Event Manager: Eintrag ohne lesbares Datum wird nicht mit dem heutigen Datum angelegt', () => {
    const html = `<div class="event_listing"><h3>Punschstand – ASKÖ Fußballverein</h3><a href="/events/punschstand/">mehr</a></div>
      <div class="event_listing"><h3>Adventmarkt</h3><time>12.12.2026</time><a href="/events/adventmarkt/">mehr</a></div>`;
    expect(parse(html).map(e => e.title)).toEqual(['Adventmarkt']);
  });

  it('The Events Calendar: Eintrag ohne lesbares Datum wird nicht angelegt', () => {
    const html = `<div class="tribe-events-list"><div class="type-tribe_events"><h2>Dartsturnier</h2><a href="/e/darts/">x</a></div></div>`;
    expect(parse(html)).toEqual([]);
  });
});
