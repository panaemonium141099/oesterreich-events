// src/__tests__/pipeline/dedup-golden-2026-10-08.test.ts
//
// Zweites Golden-Set aus der Abschlussprüfung (2026-10-08, echte Prod-Zeilen
// inkl. last_seen_at). Diese Fälle hatte der erste Umbau noch falsch:
// - frische Zeilen hingen als Duplikat hinter verwaisten Altzeilen (Feratel
//   wechselte die source_id, die Altzeile mit Zeitzonen-Versatz blieb
//   Primary): Josef Hader, Nikolospiele
// - verwaiste Altzeilen (oeticket, seit Mai tot) wurden über einen eigenen
//   Cluster wieder sichtbar: Caro Fux
// - der Mehrdeutigkeitsschutz verwarf ganze Cluster wegen eines einzigen
//   Titelpaars ("Detailinfos zu …"): Beatrice Egli, Trivium

import { describe, it, expect } from 'vitest';
import golden from '../fixtures/dedup-golden-2026-10-08.json';
import { dedupDay, groupByViennaDay } from '@/lib/pipeline/dedup-engine';
import { planDedup } from '@/lib/pipeline/dedup-plan';
import type { EventRow } from '@/lib/pipeline/types';

const ALL = golden as unknown as EventRow[];
const SEEN = '2026-10-08T07:30:00Z';
/** Jüngstes last_seen_at je Quelle laut Prod (oeticket liefert seit Juni nichts). */
const LAST_SEEN = new Map<string, string>(
  [...new Set(ALL.map(e => e.source_name!))].map(s => [s, s === 'oeticket' ? '2026-06-14T06:15:00Z' : SEEN]),
);

function rows(...prefixes: string[]): EventRow[] {
  return prefixes.map(p => {
    const r = ALL.find(e => e.id.startsWith(p));
    if (!r) throw new Error(`fixture ${p} fehlt`);
    return { ...r };
  });
}

function ownerOf(events: EventRow[]) {
  const result = dedupDay(events, { sourceLastSeen: LAST_SEEN });
  const owner = new Map<string, string>(events.map(e => [e.id.slice(0, 8), e.id.slice(0, 8)]));
  for (const c of result.clusters) for (const m of c.memberIds) owner.set(m.slice(0, 8), c.primaryId.slice(0, 8));
  return { owner, result };
}

function together(owner: Map<string, string>, ...ids: string[]) {
  for (const id of ids) expect(owner.get(id), `${id} gehört zu ${ids[0]}`).toBe(owner.get(ids[0]));
}
function apart(owner: Map<string, string>, a: string, b: string) {
  expect(owner.get(a), `${a} darf nicht mit ${b} verschmelzen`).not.toBe(owner.get(b));
}

describe('Golden 2026-10-08: Mehrfach-Listungen großer Konzerte', () => {
  it('Beatrice Egli (Stadthalle): vier Quellen, ein Event, Eventim führt', () => {
    const { owner } = ownerOf(rows('1fa442ad', '87ebaa68', '4e572ff0', '1ddaba42'));
    together(owner, '1fa442ad', '87ebaa68', '4e572ff0', '1ddaba42');
    expect(owner.get('1ddaba42')).toBe('1fa442ad');
  });

  it('Trivium & In Flames: Normal-, VIP- und "Detailinfos"-Listung sind ein Event', () => {
    const { owner } = ownerOf(rows('0117df20', '6bd96cab', '13d0ab7f', 'ef7eb891'));
    together(owner, '0117df20', '6bd96cab', '13d0ab7f', 'ef7eb891');
    expect(owner.get('ef7eb891')).toBe('0117df20');
  });

  it('Bob Dylan: je Konzerttag ein Cluster, Eventim führt, die Tage bleiben getrennt', () => {
    const days = groupByViennaDay(rows('29ae994b', 'c28e8326', '6cf0a283', 'bd9865d4', '22796676', '04ccc40d', '1c54f4f7', 'b5ae9d16'));
    const owner = new Map<string, string>();
    for (const [, evs] of days) for (const [k, v] of ownerOf(evs).owner) owner.set(k, v);
    together(owner, '29ae994b', 'c28e8326', '6cf0a283');
    expect(owner.get('6cf0a283')).toBe('29ae994b');
    together(owner, 'bd9865d4', '22796676', '04ccc40d', '1c54f4f7', 'b5ae9d16');
    expect(owner.get('1c54f4f7')).toBe('bd9865d4');
    apart(owner, '29ae994b', 'bd9865d4');
  });
});

describe('Golden 2026-10-08: verwaiste Altzeilen', () => {
  it('Caro Fux: verwaiste oeticket-Zeilen hängen am Eventim-Event statt sichtbar zu sein', () => {
    const { owner } = ownerOf(rows('b969b99d', 'eb5c0717', '6423ac3e', '05102e08', 'dea7066a'));
    together(owner, 'b969b99d', 'eb5c0717', '6423ac3e', '05102e08', 'dea7066a');
    expect(owner.get('05102e08')).toBe('b969b99d');
  });

  it('Josef Hader: die frische Zeile (19:30) führt, die Altzeile mit Zeitzonen-Versatz (21:30) hängt an ihr', () => {
    const { owner } = ownerOf(rows('6a9151fa', '06306ac7'));
    together(owner, '6a9151fa', '06306ac7');
    expect(owner.get('06306ac7')).toBe('6a9151fa');
  });

  it('Nikolospiele: jede Altzeile hängt an ihrer frischen Zeile, verschiedene Orte bleiben getrennt', () => {
    const { owner } = ownerOf(rows(
      'e3baf09d', '8a06dba3', 'f642f9f0', '0c14fc8d', 'a00c705c', '534f694f',
      '442a88bb', 'e97c07d4', '81baa3b6', '64793baa', 'b45d927b', '10399b84',
    ));
    expect(owner.get('0c14fc8d')).toBe('f642f9f0');
    expect(owner.get('8a06dba3')).toBe('e3baf09d');
    expect(owner.get('534f694f')).toBe('a00c705c');
    expect(owner.get('e97c07d4')).toBe('442a88bb');
    for (const fresh of ['e3baf09d', 'f642f9f0', 'a00c705c', '442a88bb', '81baa3b6', '64793baa', 'b45d927b']) {
      expect(owner.get(fresh), `${fresh} bleibt sichtbar`).toBe(fresh);
    }
  });

  it('Plan: frische Duplikate hinter einer verwaisten Altzeile werden sichtbar, die Altzeile verschwindet', () => {
    const events = rows('e3baf09d', '8a06dba3', 'f642f9f0', '0c14fc8d', 'a00c705c', '534f694f');
    const result = dedupDay(events, { sourceLastSeen: LAST_SEEN });
    const plan = planDedup(events, result.clusters, { sourceLastSeen: LAST_SEEN, newClusterId: () => 'neu' });
    const released = new Set(plan.release.map(r => r.id.slice(0, 8)));
    for (const fresh of ['e3baf09d', 'f642f9f0', 'a00c705c']) expect(released.has(fresh), `${fresh} freigegeben`).toBe(true);
    const hidden = new Map(plan.markDuplicate.map(m => [m.id.slice(0, 8), m.primaryId.slice(0, 8)]));
    expect(hidden.get('0c14fc8d')).toBe('f642f9f0');
  });
});
