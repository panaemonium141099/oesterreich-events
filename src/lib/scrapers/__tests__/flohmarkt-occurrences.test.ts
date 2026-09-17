import { describe, it, expect } from 'vitest';
import {
  expandFlohmarktOccurrences,
  flohmarktListingKey,
  parseFlohmarktDateList,
  parseFlohmarktTimeRange,
  stripFlohmarktScheduleBlock,
} from '../flohmarkt-occurrences';

// Exakt so kommt die Beschreibung des Henry-Flohmarkts (Rotes Kreuz
// Hollabrunn) über Boudicca aus flohmarkt.at an — Tabs und Leerzeilen
// inklusive. Prod-Zeile 609672ab, Stand 2026-09-02.
const HENRY = [
  'Mittwoch 02. September 2026',
  'HENRY FLOHMARKT  \t\t\t\t',
  '\t in 2020 Hollabrunn',
  'Aspersdorferstraße 34, 10-17 Uhr',
  'Kontakt:',
  'Rotes Kreuz Hollabrunn 059144-57004',
  'Email:',
  'henryladen.hl@n.roteskreuz.at',
  'Dieser Markt findet noch an folgenden Tagen statt:',
  '',
  '\t\t\t\t\t',
  '\t\t\t\t\tMittwoch 02. September 2026',
  'Mittwoch 09. September 2026',
  '',
  '\t\t\t\t\t Mittwoch 16. September 2026',
  '',
  '\t\t\t\t\t Mittwoch 23. September 2026',
  '',
  '\t\t\t\t\t Mittwoch 30. September 2026',
  '',
  '\t\t\t\t\t Mittwoch 07. Oktober 2026',
  '',
  '\t\t\t\t\t Mittwoch 14. Oktober 2026',
  '',
  '\t\t\t\t\t \t\t\t\t ',
  'eventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!',
].join('\n');

const HENRY_URL =
  'https://www.flohmarkt.at/flohmaerkte/niederoesterreich/veranstaltung/henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse';

describe('flohmarktListingKey', () => {
  it('nimmt das letzte Pfadsegment der flohmarkt.at-Detailseite', () => {
    expect(flohmarktListingKey(HENRY_URL)).toBe('henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse');
    expect(
      flohmarktListingKey('https://www.flohmarkt.at/flohmaerkte/niederoesterreich/veranstaltung/338793'),
    ).toBe('338793');
  });

  it('ohne URL oder ohne Segment gibt es keinen Schlüssel', () => {
    expect(flohmarktListingKey(null)).toBeNull();
    expect(flohmarktListingKey('https://www.flohmarkt.at/')).toBeNull();
  });
});

describe('parseFlohmarktDateList', () => {
  it('liest alle Termine hinter "findet noch an folgenden Tagen statt"', () => {
    expect(parseFlohmarktDateList(HENRY)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
      '2026-09-23',
      '2026-09-30',
      '2026-10-07',
      '2026-10-14',
    ]);
  });

  it('ignoriert die Kopfzeile vor dem Marker', () => {
    const text = 'Samstag 19. September 2026\nAntikmarkt\nHauptplatz, 8-12 Uhr';
    expect(parseFlohmarktDateList(text)).toEqual([]);
  });

  it('versteht Jänner/März/Dezember und einstellige Tage', () => {
    const text =
      'Dieser Markt findet noch an folgenden Tagen statt:\nSonntag 3. Jänner 2027\nSonntag 7. März 2027\nSamstag 12. Dezember 2026\neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!';
    expect(parseFlohmarktDateList(text)).toEqual(['2027-01-03', '2027-03-07', '2026-12-12']);
  });
});

describe('parseFlohmarktTimeRange', () => {
  it('"10-17 Uhr" → 10:00 bis 17:00', () => {
    expect(parseFlohmarktTimeRange('Aspersdorferstraße 34, 10-17 Uhr')).toEqual({
      start: { hour: 10, minute: 0 },
      end: { hour: 17, minute: 0 },
    });
  });

  it('halbe Stunden und führende Nullen', () => {
    expect(parseFlohmarktTimeRange('Barichgasse, 12-13:30 Uhr')).toEqual({
      start: { hour: 12, minute: 0 },
      end: { hour: 13, minute: 30 },
    });
    expect(parseFlohmarktTimeRange('Sulzbach 178, 07-16 Uhr')).toEqual({
      start: { hour: 7, minute: 0 },
      end: { hour: 16, minute: 0 },
    });
    expect(parseFlohmarktTimeRange('Hauptplatz, 9.30-15.00 Uhr')).toEqual({
      start: { hour: 9, minute: 30 },
      end: { hour: 15, minute: 0 },
    });
  });

  it('ohne "Uhr" oder ohne Bereich nichts', () => {
    expect(parseFlohmarktTimeRange('Hauptplatz 30, 2070 Retz')).toBeNull();
    expect(parseFlohmarktTimeRange('ab 8 Uhr')).toBeNull();
    // Telefonnummern sind keine Uhrzeiten.
    expect(parseFlohmarktTimeRange('Rotes Kreuz Hollabrunn 059144-57004')).toBeNull();
  });
});

describe('stripFlohmarktScheduleBlock', () => {
  it('entfernt Datums-Kopfzeile und Terminliste, behält Adresse und Kontakt', () => {
    const cleaned = stripFlohmarktScheduleBlock(HENRY);
    expect(cleaned).toBe(
      [
        'HENRY FLOHMARKT',
        'in 2020 Hollabrunn',
        'Aspersdorferstraße 34, 10-17 Uhr',
        'Kontakt:',
        'Rotes Kreuz Hollabrunn 059144-57004',
        'Email:',
        'henryladen.hl@n.roteskreuz.at',
      ].join('\n'),
    );
  });

  it('entfernt auch die zweitägige Kopfzeile', () => {
    const text = 'Freitag 18. September 2026 - Samstag 19.  September 2026\nDER BESONDERE FLOHMARKT\nin 5020 Salzburg';
    expect(stripFlohmarktScheduleBlock(text)).toBe('DER BESONDERE FLOHMARKT\nin 5020 Salzburg');
  });

  it('lässt Beschreibungen ohne die Blöcke in Ruhe', () => {
    expect(stripFlohmarktScheduleBlock('Bunt gemischt, jeden 3. Samstag.')).toBe('Bunt gemischt, jeden 3. Samstag.');
  });
});

describe('expandFlohmarktOccurrences', () => {
  it('macht aus der Terminliste einen Termin pro Tag, Wandzeit aus dem Uhrzeitbereich', () => {
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-02T08:00:00Z',
      end: null,
      description: HENRY,
    });
    expect(occ.map(o => o.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
      '2026-09-23',
      '2026-09-30',
      '2026-10-07',
      '2026-10-14',
    ]);
    expect(occ[0]).toEqual({ date: '2026-09-02', start: '2026-09-02T10:00:00', end: '2026-09-02T17:00:00' });
    // Nackte Wandzeit: 10:00 bleibt 10:00, auch wenn der Termin nach der
    // Zeitumstellung liegt — die UTC-Umrechnung macht der Schreibpfad.
    expect(occ[6]).toEqual({ date: '2026-10-14', start: '2026-10-14T10:00:00', end: '2026-10-14T17:00:00' });
  });

  it('Wandzeit nach der Zeitumstellung bleibt die genannte Uhrzeit', () => {
    const text =
      'Mittwoch 07. Oktober 2026\nHENRY FLOHMARKT\nAspersdorferstraße 34, 10-17 Uhr\nDieser Markt findet noch an folgenden Tagen statt:\nMittwoch 07. Oktober 2026\nMittwoch 04. November 2026\neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!';
    const occ = expandFlohmarktOccurrences({ start: '2026-10-07T08:00:00Z', end: null, description: text });
    expect(occ.map(o => o.start)).toEqual(['2026-10-07T10:00:00', '2026-11-04T10:00:00']);
  });

  it('ohne Liste: genau ein Termin, Beginn aus Boudicca, Ende aus dem Uhrzeitbereich', () => {
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-19T06:00:00Z',
      end: null,
      description: 'Samstag 19. September 2026\nAntikmarkt\nHauptplatz, 8-12 Uhr',
    });
    expect(occ).toEqual([{ date: '2026-09-19', start: '2026-09-19T08:00:00', end: '2026-09-19T12:00:00' }]);
  });

  it('Boudicca-Beginn schlägt den Uhrzeitbereich, wenn beide da sind und abweichen', () => {
    // Die Instanz aus Boudicca ist die Wahrheit für den Tag der Liste; der
    // Textbereich liefert nur, was Boudicca nicht hat (das Ende).
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-19T07:00:00Z',
      end: null,
      description: 'Hauptplatz, 8-12 Uhr',
    });
    expect(occ[0].start).toBe('2026-09-19T09:00:00');
    expect(occ[0].end).toBe('2026-09-19T12:00:00');
  });

  it('mehrtägig: Ende aus Boudicca wird mit Tagesabstand auf jeden Termin übertragen', () => {
    const text =
      'Freitag 18. September 2026 - Samstag 19.  September 2026\nDER BESONDERE FLOHMARKT\nMorzgerstraße 27, FR 10-18, SA 9-17 Uhr\nDieser Markt findet noch an folgenden Tagen statt:\nFreitag 18. September 2026\nFreitag 16. Oktober 2026\neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!';
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-18T08:00:00Z',
      end: '2026-09-19T15:00:00Z',
      description: text,
    });
    expect(occ).toEqual([
      { date: '2026-09-18', start: '2026-09-18T10:00:00', end: '2026-09-19T17:00:00' },
      { date: '2026-10-16', start: '2026-10-16T10:00:00', end: '2026-10-17T17:00:00' },
    ]);
  });

  it('Ende vor Beginn wird nicht erfunden', () => {
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-19T20:00:00Z',
      end: null,
      description: 'Nachtflohmarkt, 22-2 Uhr',
    });
    expect(occ[0].end).toBeNull();
  });

  it('reines Datum ohne Uhrzeit bleibt der Platzhalter, auch für Listentermine', () => {
    const occ = expandFlohmarktOccurrences({
      start: '2026-09-19',
      end: null,
      description:
        'Dieser Markt findet noch an folgenden Tagen statt:\nSamstag 19. September 2026\nSamstag 10. Oktober 2026\neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!',
    });
    expect(occ).toEqual([
      { date: '2026-09-19', start: '2026-09-19', end: null },
      { date: '2026-10-10', start: '2026-10-10', end: null },
    ]);
  });

  it('Termine vor dem Boudicca-Datum, Duplikate und Endloslisten werden begrenzt', () => {
    const list = ['Samstag 12. September 2026', 'Samstag 19. September 2026', 'Samstag 19. September 2026'];
    for (let i = 0; i < 80; i++) list.push(`Sonntag ${String((i % 28) + 1).padStart(2, '0')}. Dezember 2027`);
    const text = `Dieser Markt findet noch an folgenden Tagen statt:\n${list.join('\n')}\neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!`;
    const occ = expandFlohmarktOccurrences({ start: '2026-09-19T06:00:00Z', end: null, description: text });
    expect(occ[0].date).toBe('2026-09-19');
    expect(occ.some(o => o.date === '2026-09-12')).toBe(false);
    expect(occ.filter(o => o.date === '2026-09-19')).toHaveLength(1);
    expect(occ.length).toBeLessThanOrEqual(60);
  });

  it('ohne Beschreibung: ein Termin mit den Boudicca-Zeiten', () => {
    expect(expandFlohmarktOccurrences({ start: '2026-09-19T06:00:00Z', end: null, description: null })).toEqual([
      { date: '2026-09-19', start: '2026-09-19T08:00:00', end: null },
    ]);
  });

  it('unbrauchbarer Beginn ergibt keine Termine', () => {
    expect(expandFlohmarktOccurrences({ start: 'irgendwann', end: null, description: HENRY })).toEqual([]);
  });
});
