/**
 * Regression: der Gemeinde-Scraper 'gemeinden' nahm Datum oder Uhrzeit als
 * Titel.
 *
 * Prod-Befund 2026-10-08: "18. Oktober 2026 um 9:00 - 11:00 Uhr"
 * (gaenserndorf.at), "08.03.2027 15:00 - 15:15 Uhr" (kremsmuenster.at),
 * ", 8 bis 12 Uhr" (wien.gv.at), "10. November 2026 18:00"
 * (spielberg.at). Je Strategie ein Grund: die längste Tabellenzelle war die
 * Datumszelle, ein Listeneintrag trug nur Datum und Uhrzeit, der erste Link
 * war die Datums-Kachel.
 *
 * Die Fixtures sind gekürzte Ausschnitte der echten Seiten (Stand 2026-10-09).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GemeindeListScraper } from '../../lib/scrapers/GemeindeListScraper';

const gemeinde = {
  name: 'Testgemeinde', website: 'https://www.example.at', plz: '4550', bezirk: 'Kirchdorf an der Krems',
  bundesland: 'Oberösterreich', lat: 48.05, lng: 14.13, idKey: '40905',
};

type Parsed = {
  title: string; start_date: string; source_url: string;
  source_id: string; previous_source_id?: string;
};

function parse(file: string, url: string): Parsed[] {
  const html = readFileSync(join(__dirname, 'fixtures', file), 'utf8');
  return (new GemeindeListScraper() as any).parseCalendarPage(html, url, gemeinde);
}

describe('GemeindeListScraper: Tabelle mit Datumszelle samt Uhrzeit (kremsmuenster)', () => {
  const events = parse('gemeinde-list-kremsmuenster.html', 'https://www.kremsmuenster.at/veranstaltungen');

  it('nimmt die Spalte "Veranstaltung" statt Datum oder Ort', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Welcome Baby Frühstück', '2026-10-09'],
      ['Gallusmarkt Kremsmünster', '2026-10-10'],
      ['ABGESAGT! Mentale Stärke', '2026-10-15'],
      ['Kollagen – Sinn oder Unsinn?', '2026-10-16'],
    ]);
  });

  it('meldet die alte ID, damit der Sync die bestehende Zeile übernimmt', () => {
    expect(events[0].previous_source_id).toBe('gemeinde-40905-09-10-2026-09-00-10-30-uhr');
    expect(events[2].previous_source_id).toBe('gemeinde-40905-kulturzentrum-kremsmuenster');
  });
});

describe('GemeindeListScraper: Listeneintrag mit nur Datum und Uhrzeit', () => {
  it('nimmt die verlinkte Überschrift der Kachel (gaenserndorf)', () => {
    const events = parse('gemeinde-list-gaenserndorf.html', 'https://www.gaenserndorf.at/termine');
    expect(events.map(e => [e.title, e.start_date, e.source_url])).toEqual([
      ['GenussGaukler Wandertag', '2026-10-11', 'https://www.gaenserndorf.at/termine/genussgaukler-wandertag/'],
      ['"Tut gut!" - Vorsorge Aktiv Infoabend', '2026-10-16', 'https://www.gaenserndorf.at/termine/tut-gut-vorsorge-aktiv-infoabend/'],
    ]);
    expect(events[0].previous_source_id).toBe('gemeinde-40905-11-oktober-2026-um-8-00-9-00-uhr');
  });

  it('nimmt die verlinkte Überschrift der Kachel (wien.gv.at)', () => {
    const events = parse('gemeinde-list-wien.html', 'https://www.wien.gv.at/veranstaltungen');
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Vienna Food Innovation: Markt der Zukunft', '2026-10-09'],
      ['Apokalypse - wir sinken nicht', '2026-10-24'],
    ]);
  });
});

describe('GemeindeListScraper: Datums-Kachel als Link (spielberg, iCagenda)', () => {
  const events = parse('gemeinde-list-spielberg.html', 'https://www.spielberg.at/veranstaltungen');

  it('nimmt den Namen aus dem Link mit demselben Ziel', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['MALARINA TROPHÄENRAUB', '2026-10-09'],
      ['Das Cholesterin im Körper - Freund oder Feind', '2026-10-23'],
    ]);
    expect(events[0].previous_source_id).toBe('gemeinde-40905-09-okt-2026');
  });
});
