// src/__tests__/pipeline/dedup-plan.test.ts
//
// Der Dedup rechnet jede Nacht den Sollzustand aus den aktuellen Daten neu
// und schreibt nur die Abweichungen. Gleiche Daten → gleiches Ergebnis,
// unabhängig davon, was frühere Läufe (oder frühere Regeln) markiert haben.

import { describe, it, expect } from 'vitest';
import { dedupDay } from '@/lib/pipeline/dedup-engine';
import { planDedup, releaseStatus, checkSafetyValve } from '@/lib/pipeline/dedup-plan';
import type { EventRow } from '@/lib/pipeline/types';

const PLACE = { location_name: 'Sargfabrik', postal_code: '1140', latitude: 48.1952, longitude: 16.3046, location_precision: 'building' };
const ev = (o: Partial<EventRow> & { id: string; source_name: string }): EventRow =>
  ({ title: 'Konzert X', start_date: '2026-10-07T17:30:00Z', publish_status: 'published', source_id: o.id, quality_score: 70, ...PLACE, ...o }) as EventRow;

let n = 0;
const newId = () => `cluster-${++n}`;

function plan(events: EventRow[]) {
  return planDedup(events, dedupDay(events).clusters, { newClusterId: newId });
}

describe('planDedup', () => {
  it('neuer Cluster: Duplikat zeigt auf den Primary', () => {
    const p = plan([ev({ id: 'a', source_name: 'falter' }), ev({ id: 'b', source_name: 'Eventim' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'a', primaryId: 'b' })]);
    expect(p.release).toEqual([]);
  });

  it('bereits richtiger Zustand: keine Schreibvorgänge (idempotent)', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'falter', publish_status: 'duplicate', duplicate_of: 'b', dedup_cluster_id: 'c1' }),
      ev({ id: 'b', source_name: 'Eventim', dedup_cluster_id: 'c1' }),
    ]);
    expect(p.markDuplicate).toEqual([]);
    expect(p.release).toEqual([]);
    expect(p.primaries).toEqual([]);
  });

  it('Eventim kommt später dazu: wird Primary, alte Duplikate zeigen um', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'falter', dedup_cluster_id: 'c1' }),
      ev({ id: 'd', source_name: 'partytimer', publish_status: 'duplicate', duplicate_of: 'a', dedup_cluster_id: 'c1' }),
      ev({ id: 'e', source_name: 'Eventim' }),
    ]);
    const byId = new Map(p.markDuplicate.map(m => [m.id, m.primaryId]));
    expect(byId.get('a')).toBe('e');
    expect(byId.get('d')).toBe('e');
    // Cluster-Id bleibt stabil.
    expect(new Set(p.markDuplicate.map(m => m.clusterId))).toEqual(new Set(['c1']));
  });

  it('Primary bekommt fehlende Felder aus den Duplikaten (Wiederholung je Lauf)', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'wien-ticket', organizer: 'Sargfabrik', publish_status: 'duplicate', duplicate_of: 'b', dedup_cluster_id: 'c1' }),
      ev({ id: 'b', source_name: 'Eventim', organizer: null, dedup_cluster_id: 'c1' }),
    ]);
    expect(p.primaries).toEqual([{ id: 'b', clusterId: 'c1', enrichments: { organizer: 'Sargfabrik' } }]);
  });
});

describe('planDedup: Freigabe nur mit Gegenbeleg', () => {
  // Bestehende Verbindungen stammen aus früheren Läufen. Sie werden nur
  // gelöst, wenn die Daten jetzt klar zwei Events zeigen — sonst würden
  // Altzeilen, die der alte Dedup versteckt hatte, als Phantome auftauchen.
  const SEEN = '2026-10-07T03:00:00Z';
  const lastSeen = new Map([['falter', SEEN], ['Eventim', SEEN], ['q', SEEN]]);
  const planWith = (events: EventRow[], external = new Map<string, EventRow>()) =>
    planDedup(events, dedupDay(events, { sourceLastSeen: lastSeen }).clusters, { newClusterId: newId, sourceLastSeen: lastSeen, externalPrimaries: external });
  const dup = (o: Partial<EventRow>) =>
    ev({ publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN, ...o, id: 'a', source_name: 'falter' });
  const primary = (o: Partial<EventRow> = {}) =>
    ev({ last_seen_at: SEEN, ...o, id: 'b', source_name: 'Eventim' });

  it('ganz anderer Titel am selben Ort: zwei Events, freigeben', () => {
    const p = planWith([dup({ title: 'Ganz anderes Event' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_title' })]);
  });

  it('andere Vorstellung (über 2 h): freigeben', () => {
    const p = planWith([dup({ start_date: '2026-10-07T12:00:00Z' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_showtime' })]);
  });

  it('nur abweichendes PLZ-Etikett ist kein Gegenbeleg', () => {
    const p = planWith([
      dup({ postal_code: '5592', latitude: null, longitude: null, location_precision: null, location_name: 'Lessach' }),
      primary({ postal_code: '5575', latitude: null, longitude: null, location_precision: null, location_name: 'Lessach' }),
    ]);
    expect(p.release).toEqual([]);
  });

  it('gleiche Quelle, anderer Titel ist kein Freigabegrund (Navigations-Müll wie „zum Footer")', () => {
    const p = planWith([
      ev({ id: 'a', source_name: 'q', title: 'zum Footer', publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN }),
      ev({ id: 'b', source_name: 'q', title: 'Herbstfest', last_seen_at: SEEN }),
    ]);
    expect(p.release).toEqual([]);
  });

  it('Zeile ohne echten Titel („Samstag, , 10:00") wird nicht wieder sichtbar', () => {
    const otherDay = primary({ start_date: '2026-10-14T17:30:00Z' });
    const p = planWith([dup({ title: 'Samstag,\n\n, 10:00' })], new Map([['b', otherDay]]));
    expect(p.release).toEqual([]);
  });

  it('Rotation der Gemeinde-Aggregatoren (bis 14 Tage nicht gesehen) ist nicht verwaist', () => {
    const p = planWith([dup({ start_date: '2026-10-07T12:00:00Z', last_seen_at: '2026-09-25T03:00:00Z' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_showtime' })]);
  });

  it('verwaiste Zeile wird nicht wieder sichtbar (Zeitzonen-Altlast)', () => {
    const p = planWith([dup({ start_date: '2026-10-07T19:30:00Z', last_seen_at: '2026-08-20T03:00:00Z' }), primary()]);
    expect(p.release).toEqual([]);
  });

  it('Primary unterdrückt (Müll-Titel „Event / Party"): aktuelle echte Zeile wird freigegeben', () => {
    const junk = primary({ title: 'Event\n            Party', publish_status: 'suppressed' });
    const p = planWith([dup({ title: 'Wickie, Slime und Paiper' }), junk]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary mit Ortskonflikt zurückgehalten: aktuelle Zeile wird freigegeben', () => {
    const held = primary({ title: 'Ganz anderer Titel', publish_status: 'needs_review', location_status: 'conflict' });
    const p = planWith([dup({}), held]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary verschwunden: aktuelle Zeile wird freigegeben', () => {
    const p = planWith([dup({ duplicate_of: 'weg' })]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary unterdrückt, aber das Duplikat ist selbst Müll: bleibt verborgen', () => {
    const junk = primary({ title: 'Event\n            Party', publish_status: 'suppressed' });
    const p = planWith([dup({ title: 'Event\n            Jazz' }), junk]);
    expect(p.release).toEqual([]);
  });

  it('Primary an einem anderen Tag, beide aktuell: verschiedene Termine, freigeben', () => {
    const otherDay = primary({ start_date: '2026-10-14T17:30:00Z' });
    const p = planWith([dup({})], new Map([['b', otherDay]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_day' })]);
  });

  it('Duplikat wird selbst Primary eines Clusters: freigeben', () => {
    const p = planWith([
      dup({ duplicate_of: 'weg', quality_score: 90 }),
      ev({ id: 'c', source_name: 'q', last_seen_at: SEEN }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_of_cluster' })]);
  });

  it('Primary bekommt fehlende Felder aus den Duplikaten', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'wien-ticket', price_text: 'ab 28,70 EUR' }),
      ev({ id: 'b', source_name: 'Eventim', price_text: null }),
    ]);
    expect(p.primaries).toEqual([expect.objectContaining({ id: 'b', enrichments: expect.objectContaining({ price_text: 'ab 28,70 EUR' }) })]);
  });
});

describe('releaseStatus', () => {
  it('folgt dem gespeicherten Qualitätsscore', () => {
    expect(releaseStatus({ quality_score: 75 })).toBe('published');
    expect(releaseStatus({ quality_score: 45 })).toBe('published_low_confidence');
  });
  it('Quarantäne aus der Aufnahmeprüfung bleibt Quarantäne', () => {
    expect(releaseStatus({ quality_score: 90, admission_decision: 'quarantine' })).toBe('needs_review');
  });
  it('Ortskonflikt darf nicht veröffentlicht werden (DB-Constraint events_location_conflict_not_published)', () => {
    expect(releaseStatus({ quality_score: 90, location_status: 'conflict' })).toBe('needs_review');
  });
});

describe('checkSafetyValve', () => {
  it('meldet Massenänderungen, statt sie still zu schreiben', () => {
    const p = { markDuplicate: Array.from({ length: 11 }, (_, i) => ({ id: `x${i}`, primaryId: 'p', clusterId: 'c', score: 1, isNew: true })), release: [{ id: 'r', previousPrimaryId: 'p', reason: 'different_title' }], primaries: [] };
    expect(checkSafetyValve(p, { maxNewDuplicates: 10, maxReleases: 5 })).toHaveLength(1);
    expect(checkSafetyValve(p, { maxNewDuplicates: 20, maxReleases: 0 })).toHaveLength(1);
    expect(checkSafetyValve(p, { maxNewDuplicates: 20, maxReleases: 5 })).toHaveLength(0);
  });
});
