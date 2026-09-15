import { describe, it, expect } from 'vitest';

/**
 * fn-18 Task 8 / Filter-Modul 2026-09-15 — Filter-/Query-Bau der
 * Uebersichtsseite /aktivitaeten. Getestet wird der Wire-Vertrag gegen
 * /api/activities: Parameter-Namen, feste Reihenfolge (Edge-Cache-Key),
 * Kodierung von Umlaut-Tags/Bezirken, das Verwerfen unbekannter
 * Filterwerte, die Bezirk-setzt-Bundesland-Regel, das ilike-Muster der
 * Freitextsuche und der Seiten-URL-Codec.
 */

import {
  ACTIVITY_FILTER_TAGS,
  ACTIVITY_LIST_PAGE_SIZE,
  ACTIVITY_MAX_BEZIRKE,
  EMPTY_ACTIVITY_FILTERS,
  activitySearchPattern,
  buildActivitiesQuery,
  canonicalBezirkeFor,
  countActiveFilters,
  filtersFromPageSearch,
  filtersToPageSearch,
  hasActiveFilter,
  normalizeActivityFilters,
  normalizeActivitySearch,
  splitBezirkParam,
} from '@/lib/activities/list-query';
import { ACTIVITY_TAG_LABELS } from '@/lib/activities/tag-labels';

describe('buildActivitiesQuery', () => {
  it('baut ohne Filter nur das Limit', () => {
    expect(buildActivitiesQuery(EMPTY_ACTIVITY_FILTERS)).toBe(
      `?limit=${ACTIVITY_LIST_PAGE_SIZE}`,
    );
    expect(hasActiveFilter(EMPTY_ACTIVITY_FILTERS)).toBe(false);
    expect(countActiveFilters(EMPTY_ACTIVITY_FILTERS)).toBe(0);
  });

  it('reicht Bundesland/Tag/Setting + Cursor in fester Reihenfolge durch', () => {
    const query = buildActivitiesQuery(
      { ...EMPTY_ACTIVITY_FILTERS, bundesland: 'salzburg', tag: 'naturführung', setting: 'outdoor' },
      { cursor: 'eyJuYW1lIjoiQSJ9', limit: 10 },
    );
    // Reihenfolge fix; Umlaut-Tag muss prozentkodiert sein.
    expect(query).toBe(
      '?bundesland=salzburg&tag=naturf%C3%BChrung&setting=outdoor&limit=10&cursor=eyJuYW1lIjoiQSJ9',
    );
  });

  it('haengt Bezirke (sortiert, kommagetrennt), Freitext und count zwischen Bundesland und Limit', () => {
    const query = buildActivitiesQuery(
      {
        bundesland: 'salzburg',
        bezirke: ['zell am see', 'hallein'],
        tag: 'schwimmen',
        setting: null,
        q: 'Bad  Gastein ',
      },
      { count: true },
    );
    expect(query).toBe(
      `?bundesland=salzburg&bezirk=hallein%2Czell+am+see&tag=schwimmen&q=Bad+Gastein&count=1&limit=${ACTIVITY_LIST_PAGE_SIZE}`,
    );
    expect(countActiveFilters(filtersFromPageSearch(query))).toBe(4);
  });

  it('verwirft unbekannte Tag-/Setting-Werte und fehlerhafte Bundesland-IDs', () => {
    expect(
      normalizeActivityFilters({
        bundesland: 'Salzburg; drop',
        tag: 'nicht-im-vokabular',
        setting: 'underwater' as never,
        q: 'x',
      }),
    ).toEqual(EMPTY_ACTIVITY_FILTERS);

    expect(
      buildActivitiesQuery({ ...EMPTY_ACTIVITY_FILTERS, bundesland: 'wien', tag: 'nicht-im-vokabular' }),
    ).toBe(`?bundesland=wien&limit=${ACTIVITY_LIST_PAGE_SIZE}`);
  });

  it('alle Filter-Tags haben ein kuratiertes Anzeige-Label', () => {
    for (const tag of ACTIVITY_FILTER_TAGS) {
      expect(ACTIVITY_TAG_LABELS[tag]).toBeTruthy();
    }
  });
});

describe('Bezirke', () => {
  it('kennt die kanonischen Bezirke eines Bundeslands (lowercase)', () => {
    const sbg = canonicalBezirkeFor('salzburg');
    expect(sbg).toContain('zell am see');
    expect(sbg).toContain('salzburg (stadt)');
    expect(canonicalBezirkeFor(null)).toEqual([]);
    expect(canonicalBezirkeFor('atlantis')).toEqual([]);
  });

  it('Bezirk setzt Bundesland voraus und muss zu dessen Liste gehoeren', () => {
    // Ohne Bundesland: Bezirke fallen weg.
    expect(
      normalizeActivityFilters({ ...EMPTY_ACTIVITY_FILTERS, bezirke: ['zell am see'] }).bezirke,
    ).toEqual([]);
    // Fremder Bezirk (Tirol) im Bundesland Salzburg: weg; Case/Whitespace egal; Duplikate weg.
    expect(
      normalizeActivityFilters({
        ...EMPTY_ACTIVITY_FILTERS,
        bundesland: 'salzburg',
        bezirke: [' Zell am See', 'kitzbühel', 'zell am see', 'Hallein'],
      }).bezirke,
    ).toEqual(['hallein', 'zell am see']);
  });

  it('kappt die Bezirksliste', () => {
    const all = canonicalBezirkeFor('niederoesterreich');
    expect(all.length).toBeGreaterThan(20);
    const many = [...all, ...all];
    const n = normalizeActivityFilters({
      ...EMPTY_ACTIVITY_FILTERS,
      bundesland: 'niederoesterreich',
      bezirke: many,
    }).bezirke;
    expect(n.length).toBe(Math.min(all.length, ACTIVITY_MAX_BEZIRKE));
  });

  it('splittet den bezirk-Param an Kommas', () => {
    expect(splitBezirkParam('hallein, zell am see,,')).toEqual(['hallein', 'zell am see']);
    expect(splitBezirkParam(null)).toEqual([]);
  });
});

describe('Freitext', () => {
  it('normalisiert Whitespace und wendet Mindest-/Maximallaenge an', () => {
    expect(normalizeActivitySearch('  Bad   Ischl ')).toBe('Bad Ischl');
    expect(normalizeActivitySearch('a')).toBe('');
    expect(normalizeActivitySearch(42)).toBe('');
    expect(normalizeActivitySearch('x'.repeat(80)).length).toBe(60);
  });

  it('baut ein PostgREST-ilike-Muster ohne Steuerzeichen', () => {
    expect(activitySearchPattern('Therme')).toBe('*Therme*');
    // Punkt/Komma/Klammern wuerden den or-Filter zerlegen -> Wildcard.
    expect(activitySearchPattern('St. Johann')).toBe('*St* Johann*');
    expect(activitySearchPattern('Bad (Ischl), Salz%')).toBe('*Bad *Ischl* Salz*');
    // Apostroph, Bindestrich, & und / bleiben (Ortsnamen wie "Sankt Veit/Glan").
    expect(activitySearchPattern("Zell am See-Kaprun & Co / D'Orsay")).toBe(
      "*Zell am See-Kaprun & Co / D'Orsay*",
    );
    // Nur Sonderzeichen -> nichts Suchbares.
    expect(activitySearchPattern('***')).toBeNull();
    expect(activitySearchPattern('(),.')).toBeNull();
    expect(activitySearchPattern('a')).toBeNull();
  });
});

describe('Seiten-URL-Codec', () => {
  it('spiegelt Filter in die Seiten-URL und liest sie identisch zurueck', () => {
    const filters = normalizeActivityFilters({
      bundesland: 'tirol',
      bezirke: ['kitzbühel', 'schwaz'],
      tag: 'ski',
      setting: 'outdoor',
      q: 'Lift',
    });
    const search = filtersToPageSearch(filters);
    expect(search).toBe('?bundesland=tirol&bezirk=kitzb%C3%BChel%2Cschwaz&tag=ski&setting=outdoor&q=Lift');
    expect(filtersFromPageSearch(search)).toEqual(filters);
    expect(filtersFromPageSearch(search.slice(1))).toEqual(filters);
  });

  it('liefert ohne Filter einen leeren String und verwirft Muell aus der URL', () => {
    expect(filtersToPageSearch(EMPTY_ACTIVITY_FILTERS)).toBe('');
    expect(filtersFromPageSearch('?bezirk=zell+am+see&tag=foo&setting=bar&q=a')).toEqual(
      EMPTY_ACTIVITY_FILTERS,
    );
  });
});
