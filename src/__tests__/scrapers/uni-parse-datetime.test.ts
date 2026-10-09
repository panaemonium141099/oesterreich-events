/**
 * Regression: UniBaseScraper.parseDatetime las das Datum als Uhrzeit.
 *
 * Die Uhrzeit-Regex `(\d{1,2})[:.](\d{2})` lief über den ganzen Text und
 * traf zuerst das Datum: "16.10.2026" wurde 16:10, "28.10.2026" sogar
 * 28:10 (Befund 2026-10-09 am PPH-Augustinum-Kalender, dann bei WU,
 * FH St. Pölten und Angewandte). Alle Uni-, PH- und FH-Scraper gehen über
 * parseDatetime. Die Eingaben unten stammen aus den echten Listen-Seiten
 * (Stand 2026-10-09).
 */
import { describe, it, expect } from 'vitest';
import { WUScraper } from '../../lib/scrapers/uni/WUScraper';

const parseDatetime = (text: string): string | null =>
  (new WUScraper() as any).parseDatetime(text);

describe('UniBaseScraper.parseDatetime', () => {
  it('liest das Datum nicht als Uhrzeit', () => {
    expect(parseDatetime('12.10.2026 Student Wellbeing Systems')).toBe('2026-10-12');
    expect(parseDatetime('Ausstellungsdauer 09.10.2026 - 15.11.2026 Hotel Austria')).toBe('2026-10-09');
    expect(parseDatetime('28.09.2028')).toBe('2028-09-28');
  });

  it('findet die Uhrzeit hinter dem Datum', () => {
    expect(parseDatetime('28.10.2026 18:00 - 19:30')).toBe('2026-10-28T18:00:00');
    expect(parseDatetime('01.10.2026 09:00 - 01.03.2027 09:00')).toBe('2026-10-01T09:00:00');
    expect(parseDatetime('Symposium 09.10.2026 - 09:30 Sigmund Freud Museum, Berggasse 19, 1090 Wien'))
      .toBe('2026-10-09T09:30:00');
  });

  it('nimmt den Punkt als Trenner nur mit "Uhr"', () => {
    expect(parseDatetime('16.10.2026, 18.30 Uhr')).toBe('2026-10-16T18:30:00');
    expect(parseDatetime('16.10.2026, 9.00 Uhr')).toBe('2026-10-16T09:00:00');
    expect(parseDatetime('16.10.2026, Raum 18.30')).toBe('2026-10-16');
  });

  it('verwirft Stunden und Minuten außerhalb des Tages', () => {
    expect(parseDatetime('16.10.2026 25:30')).toBe('2026-10-16');
    expect(parseDatetime('16.10.2026 18:75')).toBe('2026-10-16');
  });

  it('lässt Monatsnamen und ISO-Angaben unverändert', () => {
    expect(parseDatetime('03. Nov 2026 16:00 - 20:00')).toBe('2026-11-03T16:00:00');
    expect(parseDatetime('15. Oktober 2026')).toBe('2026-10-15');
    expect(parseDatetime('2026-10-15T18:30:00+02:00')).toBe('2026-10-15T18:30:00');
  });

  it('ohne Datum keine Angabe', () => {
    expect(parseDatetime('18:30 Uhr')).toBeNull();
  });
});
