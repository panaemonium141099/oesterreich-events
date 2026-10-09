/**
 * Regression: gemeinden-generic nahm Datum oder Uhrzeit als Titel.
 *
 * Prod-Befund 2026-10-08: Zeilen mit Titeln wie "Freitag, 18.09.2026 ,
 * 17:00 bis 23.10.2026" (tulln.at), "09.10.2026" (herzogenburg.at),
 * "Fr Okt 09" (ybbs.gv.at), "10.10.2026" (allerheiligen-wildon.at) oder
 * "07:00" (tillmitsch.at). Der Müll-Filter verwirft solche Titel, das
 * Event dahinter ging verloren. Die Parser nahmen das erste Element einer
 * Stufe (Überschrift, Link, Fettdruck), auch wenn es nur das Datum trug.
 *
 * Die Fixtures sind gekürzte Ausschnitte der echten Seiten (Stand 2026-10-09).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GenericGemeindeScraper } from '../../lib/scrapers/GenericGemeindeScraper';
import { isNamelessTitle } from '../../lib/scrapers/event-title';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const page = (url: string) => ({
  gemeinde: {
    name: 'Testgemeinde', website: url, plz: '3430', bezirk: 'Tulln',
    bundesland: 'Niederösterreich', lat: 48.33, lng: 16.05, idKey: '32135',
  },
  eventPageUrl: url,
  path: '/veranstaltungen', dateCount: 1, eventKeywords: 1, htmlSize: 1000,
});

type Parsed = {
  title: string; start_date: string; source_url: string;
  source_id: string; previous_source_id?: string;
};

function parse(file: string, url: string): Parsed[] {
  const scraper = new GenericGemeindeScraper();
  return (scraper as any).parsePage(fixture(file), page(url));
}

describe('isNamelessTitle', () => {
  it('erkennt Datums- und Uhrzeittexte aus dem Prod-Befund', () => {
    for (const t of [
      '9. Oktober', '12. Dezember', 'Sa, ab 19:30', 'Freitag, 13.11.2026 , 19:30 bis 13.11.2026',
      'Samstag,\n\n\n, 13:00', 'Mittwoch,9:9Uhr - 9:9Uhr', ', 14 bis 22 Uhr', 'OKTOBER 2026',
      'Di, 22. Dezember', 'Fr Okt 09', '07:00', 'Mittwoch', '08 30', '',
    ]) expect(isNamelessTitle(t), t).toBe(true);
  });

  it('lässt Namen stehen, auch mit Datum oder Zahl darin', () => {
    for (const t of [
      'Schützenball', 'Oktoberfest', '1. Mai Feier', '34. Weihnachtsmarkt in Brand',
      'Kontakt', 'Ufo361', 'Konzert am 12.10.2026',
    ]) expect(isNamelessTitle(t), t).toBe(false);
  });
});

describe('GenericGemeindeScraper: Kachel länger als ein Block (tulln)', () => {
  const events = parse('gemeinde-generic-tulln.html', 'https://www.tulln.at/veranstaltungen/veranstaltungstermine');

  it('nimmt den Titel der Kachel statt der Datumszeile', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Starke Kinder wachsen Schritt für Schritt - BAMBINI-TAEKWONDO', '2026-09-18T17:00'],
      ['STARKE KINDER - STARKER CHARAKTER', '2026-09-18T18:00'],
    ]);
  });

  it('verlinkt die Detailseite der Kachel', () => {
    expect(events[0].source_url).toBe(
      'https://www.tulln.at/veranstaltungen/veranstaltungstermine/detail/starke-kinder-wachsen-schritt-fuer-schritt-bambini-taekwondo',
    );
  });

  it('meldet die alte ID, damit der Sync die bestehende Zeile übernimmt', () => {
    expect(events[0].previous_source_id).toBe('gemeinden-generic-32135-freitag-18-09-2026-17-00-bis-23-10-2026-2026-09-18');
  });
});

describe('GenericGemeindeScraper: Datums-Überschrift vor dem Titel (herzogenburg)', () => {
  const events = parse('gemeinde-generic-herzogenburg.html', 'https://www.herzogenburg.at/?kat=4370');

  it('überspringt die h4 mit dem Datum', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Schwedenbomben Frischdienst-Verkauf', '2026-10-09'],
      ['Puppentheater - geliebter Taraxacum', '2026-10-10'],
    ]);
    expect(events[0].previous_source_id).toBe('gemeinden-generic-32135-09-10-2026-2026-10-09');
  });
});

describe('GenericGemeindeScraper: Datums-Link vor dem Titel-Link (ybbs)', () => {
  const events = parse('gemeinde-generic-ybbs.html', 'https://www.ybbs.gv.at/veranstaltungen/');

  it('nimmt den Titel-Link statt "Fr Okt 09" oder der Uhrzeit "08 30"', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Eltern-Kind-Gruppe', '2026-10-09T08:30'],
      ['SU Hotvolleys Meisterschaftsspiel 1. Landesliga Damen gegen Waidhofen an der Ybbs', '2026-10-10T18:00'],
    ]);
    expect(events[0].previous_source_id).toBe('gemeinden-generic-32135-fr-okt-09-2026-10-09');
  });
});

describe('GenericGemeindeScraper: tx_news-Liste mit Datums-Link (allerheiligen-wildon)', () => {
  const events = parse('gemeinde-generic-allerheiligen.html', 'https://www.allerheiligen-wildon.at/gemeinde-verwaltung/kalender/');

  it('nimmt die Überschrift statt des Datums-Links', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Fußball-Jugendtag SAZ', '2026-10-10'],
      ['Kastanien & Sturm beim Sparverein Windisch', '2026-10-17'],
    ]);
    expect(events[0].previous_source_id).toBe('gemeinden-generic-32135-10-10-2026');
  });
});

describe('GenericGemeindeScraper: Kachel mit Von/Bis (tillmitsch)', () => {
  const events = parse('gemeinde-generic-tillmitsch.html', 'https://www.tillmitsch.at/veranstaltungen/');

  it('macht aus den Von/Bis-Zeilen keine eigenen Events', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Infoabend – FF-Tillmitsch', '2026-10-08T18:00'],
      ['Klimaticket', '2026-10-09T07:00'],
    ]);
  });
});

describe('GenericGemeindeScraper: Überschrift nur ein Datum (völkermarkt)', () => {
  const events = parse('gemeinde-generic-voelkermarkt.html', 'https://voelkermarkt.gv.at/veranstaltungskalender');

  it('rät den Titel nicht aus dem Fließtext ("BEITRAG VOM")', () => {
    expect(events.map(e => e.title)).toEqual(['Herbstfest der FF Völkermarkt']);
  });
});
