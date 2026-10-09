// src/__tests__/pipeline/dedup-safety.test.ts
//
// Schutzregeln, die verhindern, dass der Dedup verschiedene Events
// verschmilzt: Ketten über mehrdeutige Einträge, verschiedene Venues am
// selben Ort, manuelle Entscheidungen.

import { describe, it, expect } from 'vitest';
import { dedupDay } from '@/lib/pipeline/dedup-engine';
import type { EventRow } from '@/lib/pipeline/types';

const PLACE = {
  location_name: 'Festzelt Prater',
  postal_code: '1020',
  latitude: 48.2166,
  longitude: 16.3958,
  location_precision: 'building',
};

function ev(o: Partial<EventRow> & { id: string; title: string; start_date: string; source_name: string }): EventRow {
  return { source_id: o.id, publish_status: 'published', ...PLACE, ...o } as EventRow;
}

function ownerMap(events: EventRow[], opts?: Parameters<typeof dedupDay>[1]) {
  const owner = new Map<string, string>(events.map(e => [e.id, e.id]));
  for (const c of dedupDay(events, opts).clusters) for (const m of c.memberIds) owner.set(m, c.primaryId);
  return owner;
}

describe('Mehrdeutige Einträge verbinden keine verschiedenen Events', () => {
  it('Sammeleintrag „Kaiser Wiesn" verschmilzt nicht zwei Acts verschiedener Quellen', () => {
    const umbrella = ev({ id: 'u', title: 'Kaiser Wiesn', start_date: '2026-09-26T00:00:00Z', source_name: 'q1' });
    const act1 = ev({ id: 'a1', title: 'Kaiser Wiesn – Dirndl Rocker', start_date: '2026-09-26T00:00:00Z', source_name: 'q2' });
    const act2 = ev({ id: 'a2', title: 'Kaiser Wiesn – Die Lauser', start_date: '2026-09-26T00:00:00Z', source_name: 'q3' });
    const owner = ownerMap([umbrella, act1, act2]);
    expect(owner.get('a1')).not.toBe(owner.get('a2'));
    // Der Sammeleintrag hängt sich an keinen der beiden Acts.
    expect(owner.get('u')).toBe('u');
  });

  it('verschachtelte Titel derselben Aufführung (gleiche Zeit, gleicher Saal) machen den Kurztitel nicht mehrdeutig', () => {
    const shortT = ev({ id: 's', title: 'KI UND K.O.', start_date: '2026-10-10T00:00:00Z', source_name: 'q1' });
    const y = ev({ id: 'y', title: "Theaterabend in Steeg ''KI & K.O.''", start_date: '2026-10-10T16:30:00Z', source_name: 'q2' });
    const z = ev({ id: 'z', title: '"KI und K.O." - Theater in Steeg', start_date: '2026-10-10T16:30:00Z', source_name: 'q3' });
    const owner = ownerMap([shortT, y, z]);
    expect(owner.get('s')).toBe(owner.get('y'));
    expect(owner.get('s')).toBe(owner.get('z'));
  });

  it('ein Eintrag nur mit Ortsangabe verbindet nicht zwei verschiedene Kirchen', () => {
    const base = { postal_code: '7000', latitude: null, longitude: null, location_precision: null };
    const martin = ev({ ...base, id: 'm', title: 'Hl. Messe', start_date: '2026-10-11T00:00:00Z', source_name: 'q1', location_name: 'Pfarrkirche St. Martin' });
    const georg = ev({ ...base, id: 'g', title: 'Hl. Messe', start_date: '2026-10-11T00:00:00Z', source_name: 'q2', location_name: 'Pfarrkirche St. Georg' });
    const sparse = ev({ ...base, id: 's', title: 'Hl. Messe', start_date: '2026-10-11T00:00:00Z', source_name: 'q3', location_name: null });
    const owner = ownerMap([martin, georg, sparse]);
    expect(owner.get('m')).not.toBe(owner.get('g'));
  });
});

describe('Dieselbe Quelle listet eine Show mehrfach (Prod 2026-10-07)', () => {
  it('„Bob Dylan" und „Bob Dylan - VIP Packages" sind dieselbe Show und machen andere Quellen nicht mehrdeutig', () => {
    const main = ev({ id: 'e1', title: 'Bob Dylan', start_date: '2026-11-12T19:00:00Z', source_name: 'Eventim' });
    const vip = ev({ id: 'e2', title: 'Bob Dylan - VIP Packages', start_date: '2026-11-12T19:00:00Z', source_name: 'Eventim' });
    const hall = ev({ id: 'h', title: 'Bob Dylan', start_date: '2026-11-12T19:00:00Z', source_name: 'stadthalle' });
    const owner = ownerMap([main, vip, hall]);
    expect(owner.get('h')).toBe(owner.get('e1'));
    expect(owner.get('e2')).toBe(owner.get('e1'));
  });

  it('verschiedene Acts derselben Quelle bleiben getrennt', () => {
    const a = ev({ id: 'a', title: 'Kaiser Wiesn - Dirndl Rocker', start_date: '2026-09-26T14:30:00Z', source_name: 'Eventim' });
    const b = ev({ id: 'b', title: 'Kaiser Wiesn - Die Lauser', start_date: '2026-09-26T14:30:00Z', source_name: 'Eventim' });
    const owner = ownerMap([a, b]);
    expect(owner.get('a')).not.toBe(owner.get('b'));
  });
});

describe('Verwaiste Altzeilen (Quelle liefert sie nicht mehr)', () => {
  const lastSeen = new Map([['q1', '2026-10-07T03:00:00Z'], ['q2', '2026-10-07T03:00:00Z']]);
  const fresh = { last_seen_at: '2026-10-07T03:00:00Z' };

  it('eine Altzeile mit Zeitzonen-Versatz macht den passenden Eintrag nicht mehrdeutig', () => {
    const y = ev({ id: 'y', title: 'Gernot Kulis', start_date: '2026-10-16T17:30:00Z', source_name: 'q1', ...fresh });
    const stale = ev({ id: 'y-alt', title: 'Gernot Kulis', start_date: '2026-10-16T19:30:00Z', source_name: 'q1', last_seen_at: '2026-08-20T03:00:00Z' });
    const x = ev({ id: 'x', title: 'Gernot Kulis', start_date: '2026-10-16T00:00:00Z', source_name: 'q2', ...fresh });
    const owner = ownerMap([y, stale, x], { sourceLastSeen: lastSeen });
    expect(owner.get('x')).toBe(owner.get('y'));
  });

  it('verwaiste Zeile wird nie Primary, solange eine aktuelle Zeile da ist', () => {
    const stale = ev({ id: 'alt', title: 'Konzert X', start_date: '2026-10-16T17:30:00Z', source_name: 'Eventim', last_seen_at: '2026-08-20T03:00:00Z' });
    const live = ev({ id: 'neu', title: 'Konzert X', start_date: '2026-10-16T17:30:00Z', source_name: 'q2', ...fresh });
    const [cluster] = dedupDay([stale, live], { sourceLastSeen: new Map([['Eventim', '2026-10-07T03:00:00Z'], ['q2', '2026-10-07T03:00:00Z']]) }).clusters;
    expect(cluster.primaryId).toBe('neu');
  });
});

describe('Ort widerspricht', () => {
  it('gleicher Titel, Pins mehr als 1 km auseinander in verschiedenen PLZ: zwei Events', () => {
    const a = ev({ id: 'a', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q1' });
    const b = ev({ id: 'b', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', postal_code: '1200', latitude: 48.2300, longitude: 16.3958 });
    const owner = ownerMap([a, b]);
    expect(owner.get('a')).not.toBe(owner.get('b'));
  });

  it('gleicher Titel, gleiche PLZ, Pins über 5 km auseinander: zwei Events', () => {
    const a = ev({ id: 'a', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q1' });
    const b = ev({ id: 'b', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', latitude: 48.2700, longitude: 16.3958 });
    const owner = ownerMap([a, b]);
    expect(owner.get('a')).not.toBe(owner.get('b'));
  });

  it('gleicher Titel, nahe Pins, aber klar verschiedene Lokale: zwei Events', () => {
    const a = ev({ id: 'a', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q1', location_name: 'Flex' });
    const b = ev({ id: 'b', title: 'Pub Quiz', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', location_name: 'Chelsea', latitude: 48.2168 });
    const owner = ownerMap([a, b]);
    expect(owner.get('a')).not.toBe(owner.get('b'));
  });
});

describe('Manuelle Entscheidungen haben Vorrang', () => {
  const a = ev({ id: 'a', title: 'Herbstfest', start_date: '2026-10-10T08:00:00Z', source_name: 'q1' });
  const b = ev({ id: 'b', title: 'Herbstfest', start_date: '2026-10-10T08:00:00Z', source_name: 'q2' });

  it('manual_split trennt ein sonst eindeutiges Paar', () => {
    const owner = ownerMap([a, b], { manualSplits: new Set(['a:b']) });
    expect(owner.get('a')).not.toBe(owner.get('b'));
  });

  it('manual_merge verbindet ein sonst getrenntes Paar', () => {
    const c = ev({ id: 'c', title: 'Erntedank', start_date: '2026-10-10T08:00:00Z', source_name: 'q3' });
    const owner = ownerMap([a, c], { manualMerges: new Set(['a:c']) });
    expect(owner.get('a')).toBe(owner.get('c'));
  });
});

describe('Primary-Wahl', () => {
  it('Eventim führt (Affiliate-Ticketlink)', () => {
    const a = ev({ id: 'a', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'falter', quality_score: 99 });
    const b = ev({ id: 'b', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'Eventim', quality_score: 50 });
    const [cluster] = dedupDay([a, b]).clusters;
    expect(cluster.primaryId).toBe('b');
  });

  it('ein Titel nur aus Datum/Uhrzeit wird nie Primary (Prod: „Donnerstag, 15.10.2026 , 19:00")', () => {
    const ticket = { ticket_url: 'https://www.tulln.at/veranstaltung/4711' };
    const junk = ev({ id: 'j', title: 'Donnerstag, 15.10.2026 , 19:00', start_date: '2026-10-15T17:00:00Z', source_name: 'q1', quality_score: 95, ...ticket });
    const real = ev({ id: 'r', title: 'Tullner Zeit·Geschichten: Tulln 1986', start_date: '2026-10-15T17:00:00Z', source_name: 'q2', quality_score: 60, ...ticket });
    const [cluster] = dedupDay([junk, real]).clusters;
    expect(cluster.primaryId).toBe('r');
  });

  it('Zeile mit Ortskonflikt wird nicht Primary (dürfte nie veröffentlicht werden)', () => {
    const conflict = ev({ id: 'c', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'Eventim', quality_score: 99, publish_status: 'duplicate', location_status: 'conflict' } as Partial<EventRow> & { id: string; title: string; start_date: string; source_name: string });
    const ok = ev({ id: 'o', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', quality_score: 50 });
    const [cluster] = dedupDay([conflict, ok]).clusters;
    expect(cluster.primaryId).toBe('o');
  });

  it('Datum ohne Jahr am Titelende zählt auch als eingebautes Datum („… am 10.10.")', () => {
    const at = { start_date: '2026-10-10T17:00:00Z', location_name: 'Musikheim', postal_code: '7000' };
    const dated = ev({ id: 'd', title: 'Herbstkonzert Musikverein am 10.10.', source_name: 'q1', quality_score: 95, ...at });
    const clean = ev({ id: 'c', title: 'Herbstkonzert Musikverein', source_name: 'q2', quality_score: 60, ...at });
    const [cluster] = dedupDay([dated, clean]).clusters;
    expect(cluster.primaryId).toBe('c');
  });

  it('Titel ohne eingebautes Datum wird angezeigt (Prod: „Biodiversitätszentrum … 19.11.2026")', () => {
    const ticket = { ticket_url: 'https://www.ooe.gv.at/v/123' };
    const dated = ev({ id: 'd', title: 'Biodiversitätszentrum Oberösterreich 19.11.2026', start_date: '2026-11-19T17:00:00Z', source_name: 'q1', quality_score: 95, ...ticket });
    const clean = ev({ id: 'c', title: 'Alaskas hocharktische Vogelwelt', start_date: '2026-11-19T17:00:00Z', source_name: 'q2', quality_score: 60, ...ticket });
    const [cluster] = dedupDay([dated, clean]).clusters;
    expect(cluster.primaryId).toBe('c');
  });

  it('ein Duplikat in Quarantäne wird nicht Primary (sonst kippt der Primary jede Nacht)', () => {
    const quarantined = ev({ id: 'q', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'Eventim', quality_score: 99, publish_status: 'duplicate', duplicate_of: 'o', admission_decision: 'quarantine' } as Partial<EventRow> & { id: string; title: string; start_date: string; source_name: string });
    const ok = ev({ id: 'o', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', quality_score: 50 });
    const [cluster] = dedupDay([quarantined, ok]).clusters;
    expect(cluster.primaryId).toBe('o');
  });

  it('sichtbare Zeile vor needs_review', () => {
    const a = ev({ id: 'a', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q1', quality_score: 99, publish_status: 'needs_review' });
    const b = ev({ id: 'b', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', quality_score: 50 });
    const [cluster] = dedupDay([a, b]).clusters;
    expect(cluster.primaryId).toBe('b');
  });

  it('bestehender Primary bleibt bei Gleichstand (keine URL-Wechsel von Nacht zu Nacht)', () => {
    const a = ev({ id: 'a', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q1', quality_score: 70 });
    const b = ev({ id: 'b', title: 'Konzert X', start_date: '2026-10-08T18:00:00Z', source_name: 'q2', quality_score: 70, publish_status: 'published' });
    const aDup = { ...a, publish_status: 'duplicate', duplicate_of: 'b' };
    const [cluster] = dedupDay([aDup, b]).clusters;
    expect(cluster.primaryId).toBe('b');
  });
});
