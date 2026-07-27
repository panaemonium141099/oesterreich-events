import { describe, it, expect } from 'vitest';

/**
 * fn-18 Task 8 — Filter-/Query-Bau der Uebersichtsseite /aktivitaeten.
 * Getestet wird der Wire-Vertrag gegen /api/activities: Parameter-Namen,
 * feste Reihenfolge (Edge-Cache-Key), Kodierung von Umlaut-Tags und das
 * Verwerfen unbekannter Filterwerte.
 */

import {
  ACTIVITY_FILTER_TAGS,
  ACTIVITY_LIST_PAGE_SIZE,
  EMPTY_ACTIVITY_FILTERS,
  buildActivitiesQuery,
  hasActiveFilter,
  normalizeActivityFilters,
} from '@/lib/activities/list-query';
import { ACTIVITY_TAG_LABELS } from '@/lib/activities/tag-labels';

describe('buildActivitiesQuery', () => {
  it('baut ohne Filter nur das Limit', () => {
    expect(buildActivitiesQuery(EMPTY_ACTIVITY_FILTERS)).toBe(
      `?limit=${ACTIVITY_LIST_PAGE_SIZE}`,
    );
    expect(hasActiveFilter(EMPTY_ACTIVITY_FILTERS)).toBe(false);
  });

  it('reicht Bundesland/Tag/Setting + Cursor in fester Reihenfolge durch', () => {
    const query = buildActivitiesQuery(
      { bundesland: 'salzburg', tag: 'naturführung', setting: 'outdoor' },
      { cursor: 'eyJuYW1lIjoiQSJ9', limit: 10 },
    );
    // Reihenfolge fix; Umlaut-Tag muss prozentkodiert sein.
    expect(query).toBe(
      '?bundesland=salzburg&tag=naturf%C3%BChrung&setting=outdoor&limit=10&cursor=eyJuYW1lIjoiQSJ9',
    );
  });

  it('verwirft unbekannte Tag-/Setting-Werte und fehlerhafte Bundesland-IDs', () => {
    expect(
      normalizeActivityFilters({
        bundesland: 'Salzburg; drop',
        tag: 'nicht-im-vokabular',
        setting: 'underwater' as never,
      }),
    ).toEqual(EMPTY_ACTIVITY_FILTERS);

    expect(
      buildActivitiesQuery({ bundesland: 'wien', tag: 'nicht-im-vokabular', setting: null }),
    ).toBe(`?bundesland=wien&limit=${ACTIVITY_LIST_PAGE_SIZE}`);
  });

  it('alle Filter-Tags haben ein kuratiertes Anzeige-Label', () => {
    for (const tag of ACTIVITY_FILTER_TAGS) {
      expect(ACTIVITY_TAG_LABELS[tag]).toBeTruthy();
    }
  });
});
