/**
 * „Auch gelistet bei": Quellen der Dubletten auf der Detailseite.
 *
 * Auslöser 2026-10-07: Der Dedup übernimmt Beschreibung, Bild, Preise usw.
 * der Dubletten in den Primary, die Seite nannte aber nur dessen Quelle.
 */
import { describe, it, expect } from 'vitest';
import { buildAlsoListedSources, sourceLabelOf, uniqueSourceRows } from '@/lib/events/also-listed-sources';

const falter = { name: 'falter', url: 'https://www.falter.at/event/1081199/fehringers-kalte-kueche' };

describe('buildAlsoListedSources', () => {
  it('nennt jede Dubletten-Quelle mit Link', () => {
    expect(
      buildAlsoListedSources(falter, [
        { source_name: 'wien-ticket', source_url: 'https://www.wien-ticket.at/de/ticket/150847' },
        { source_name: 'partytimer', source_url: 'https://www.partytimer.at/events/1741099' },
      ]),
    ).toEqual([
      { label: 'partytimer', url: 'https://www.partytimer.at/events/1741099' },
      { label: 'wien-ticket', url: 'https://www.wien-ticket.at/de/ticket/150847' },
    ]);
  });

  it('nennt die Quelle des Primarys nicht noch einmal', () => {
    expect(
      buildAlsoListedSources(falter, [
        { source_name: 'falter', source_url: 'https://www.falter.at/event/42' },
        { source_name: ' Falter ', source_url: null },
      ]),
    ).toEqual([]);
  });

  it('gleiche Quelle mehrfach: nur einmal, mit dem ersten gültigen Link', () => {
    expect(
      buildAlsoListedSources(falter, [
        { source_name: 'ntry.at', source_url: null },
        { source_name: 'ntry.at', source_url: 'https://ntry.at/a/performances/1' },
        { source_name: 'NTRY.AT', source_url: 'https://ntry.at/b/performances/2' },
      ]),
    ).toEqual([{ label: 'ntry.at', url: 'https://ntry.at/a/performances/1' }]);
  });

  it('ohne Namen zählt der Host der URL als Quelle', () => {
    expect(
      buildAlsoListedSources(falter, [{ source_name: null, source_url: 'https://www.example-tickets.at/e/1' }]),
    ).toEqual([{ label: 'example-tickets.at', url: 'https://www.example-tickets.at/e/1' }]);
  });

  it('Zeilen ohne Namen und ohne URL fallen weg', () => {
    expect(buildAlsoListedSources(falter, [{ source_name: '  ', source_url: null }])).toEqual([]);
  });

  it('nur http(s) wird verlinkt, der Name bleibt sichtbar', () => {
    expect(
      buildAlsoListedSources(falter, [
        { source_name: 'kaputt', source_url: 'javascript:alert(1)' },
        { source_name: 'relativ', source_url: '/events/1' },
      ]),
    ).toEqual([
      { label: 'kaputt', url: null },
      { label: 'relativ', url: null },
    ]);
  });

  it('regionale Overrides gelten auch für Dubletten (Ötztal Tourismus statt feratel-deskline)', () => {
    expect(
      buildAlsoListedSources(falter, [
        { source_name: 'feratel-deskline', source_url: null, postal_code: '6450', location_name: 'Sölden' },
      ]),
    ).toEqual([{ label: 'Ötztal Tourismus', url: 'https://www.soelden.com' }]);
  });

  it('Primary mit Override: dieselbe Region als Dublette wird nicht wiederholt', () => {
    const primary = { name: 'Ötztal Tourismus', url: 'https://www.oetztal.com' };
    expect(
      buildAlsoListedSources(primary, [
        { source_name: 'feratel-deskline', source_url: null, postal_code: '6433', location_name: 'Oetz' },
      ]),
    ).toEqual([]);
  });

  it('Primary ohne Quelle: alle Dubletten-Quellen erscheinen', () => {
    expect(
      buildAlsoListedSources({ name: null, url: null }, [{ source_name: 'falter', source_url: null }]),
    ).toEqual([{ label: 'falter', url: null }]);
  });

  it('Reihenfolge ist alphabetisch und unabhängig von der DB-Reihenfolge', () => {
    const rows = [
      { source_name: 'wien-ticket', source_url: null },
      { source_name: 'Eventim', source_url: null },
      { source_name: 'ntry.at', source_url: null },
    ];
    const a = buildAlsoListedSources(falter, rows).map(s => s.label);
    const b = buildAlsoListedSources(falter, [...rows].reverse()).map(s => s.label);
    expect(a).toEqual(['Eventim', 'ntry.at', 'wien-ticket']);
    expect(b).toEqual(a);
  });
});

describe('uniqueSourceRows', () => {
  it('Serien-Cluster: viele Zeilen einer Quelle schrumpfen auf eine, die zweite Quelle bleibt', () => {
    const rows = [
      ...Array.from({ length: 155 }, (_, i) => ({ source_name: 'gem2go', source_url: i === 0 ? null : `https://x.gem2go.at/e/${i}` })),
      { source_name: 'falter', source_url: 'https://www.falter.at/event/1' },
    ];
    const unique = uniqueSourceRows(rows);
    expect(unique).toHaveLength(2);
    // erste Zeile hatte keinen Link, also gewinnt die erste mit Link
    expect(unique.find(r => r.source_name === 'gem2go')?.source_url).toBe('https://x.gem2go.at/e/1');
  });
});

describe('sourceLabelOf', () => {
  it('Name vor Host, Host ohne www', () => {
    expect(sourceLabelOf({ name: ' falter ', url: 'https://www.falter.at/x' })).toBe('falter');
    expect(sourceLabelOf({ name: null, url: 'https://www.falter.at/x' })).toBe('falter.at');
    expect(sourceLabelOf({ name: null, url: null })).toBeNull();
  });
});
