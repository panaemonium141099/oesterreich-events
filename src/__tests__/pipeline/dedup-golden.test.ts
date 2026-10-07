// src/__tests__/pipeline/dedup-golden.test.ts
//
// Golden-Set aus echten Prod-Zeilen (Stand 2026-10-07). Jede Gruppe ist ein
// Wiener Kalendertag, wie ihn der Batch-Dedup sieht. Die Erwartungen sind
// von Hand gegen die Quellen geprüft: welche Zeilen dasselbe reale Event
// sind und welche nicht. Wer den Dedup ändert, muss hier grün bleiben;
// neue Fehlerfälle aus Prod gehören als weitere Gruppe hier hinein.

import { describe, it, expect } from 'vitest';
import golden from '../fixtures/dedup-golden-2026-10.json';
import { dedupDay, groupByViennaDay } from '@/lib/pipeline/dedup-engine';
import type { EventRow } from '@/lib/pipeline/types';

const ALL = golden as unknown as EventRow[];

function rows(...prefixes: string[]): EventRow[] {
  return prefixes.map(p => {
    const r = ALL.find(e => e.id.startsWith(p));
    if (!r) throw new Error(`fixture ${p} fehlt`);
    return r;
  });
}

/** Cluster-Zugehörigkeit als Map id-Präfix → Primary-Präfix (eigene Id, wenn allein). */
function clusterOf(events: EventRow[]) {
  const result = dedupDay(events);
  const owner = new Map<string, string>();
  for (const e of events) owner.set(e.id.slice(0, 8), e.id.slice(0, 8));
  for (const c of result.clusters) {
    for (const m of c.memberIds) owner.set(m.slice(0, 8), c.primaryId.slice(0, 8));
  }
  return { owner, result };
}

function together(owner: Map<string, string>, ...ids: string[]) {
  const first = owner.get(ids[0]);
  for (const id of ids) expect(owner.get(id), `${id} gehört zu ${ids[0]}`).toBe(first);
}

function apart(owner: Map<string, string>, a: string, b: string) {
  expect(owner.get(a), `${a} darf nicht mit ${b} verschmelzen`).not.toBe(owner.get(b));
}

describe('Golden-Set: dieselben Events verschmelzen quellenübergreifend', () => {
  it('Fehringer´s Kalte Küche (Sargfabrik): 5 Quellen, ein Event, Eventim führt', () => {
    const ev = rows('3ba91446', '3f2864bf', '23d5e9a9', '22c78230', '9d7ac9f7');
    const { owner } = clusterOf(ev);
    together(owner, '3ba91446', '3f2864bf', '23d5e9a9', '22c78230', '9d7ac9f7');
    expect(owner.get('9d7ac9f7')).toBe('3f2864bf');
  });

  it('Dreiviertelblut (STADTSAAL vs. STADTSAAL Wien)', () => {
    const { owner } = clusterOf(rows('e63b1136', '7dda63c5'));
    together(owner, 'e63b1136', '7dda63c5');
    expect(owner.get('e63b1136')).toBe('7dda63c5');
  });

  it('Das Phantom der Oper: Kurztitel und Titel mit Untertitel', () => {
    const { owner } = clusterOf(rows('252c1223', '58ed8107', 'adb19877'));
    together(owner, '252c1223', '58ed8107', 'adb19877');
    expect(owner.get('252c1223')).toBe('58ed8107');
  });

  it('Kreativ Werkstatt: Platzhalter-Uhrzeit gegen echte Uhrzeit', () => {
    const { owner } = clusterOf(rows('cfb9e3ab', 'ee65f207'));
    together(owner, 'cfb9e3ab', 'ee65f207');
  });

  it('"Der Bockerer" aus zwei Gemeinde-Quellen', () => {
    const { owner } = clusterOf(rows('06532833', '4412287a'));
    together(owner, '06532833', '4412287a');
  });

  it('Neunundneunzig: POSTHOF - Kleiner Saal / Posthof, mit Tour-Untertitel', () => {
    const { owner } = clusterOf(rows('8863e3ac', 'c3d50a80', '7ca042a1'));
    together(owner, '8863e3ac', 'c3d50a80', '7ca042a1');
    expect(owner.get('7ca042a1')).toBe('8863e3ac');
  });

  it('Sooshi Mango: drei Titelvarianten derselben Tour', () => {
    const { owner } = clusterOf(rows('fa74d46f', '02548ec6', 'e27bae23', '9c07fe6f'));
    together(owner, 'fa74d46f', '02548ec6', 'e27bae23', '9c07fe6f');
    expect(owner.get('9c07fe6f')).toBe('fa74d46f');
  });

  it('United Battle Culture: HTML-Entity im Titel, Untertitel', () => {
    const { owner } = clusterOf(rows('ba8db907', '13722ae3', '974f4498', '0350dfa2'));
    together(owner, 'ba8db907', '13722ae3', '974f4498', '0350dfa2');
  });

  it('Linzer Torte mit Schlag: Venue-Pin gegen Stadtmittelpunkt „Linz"', () => {
    const { owner } = clusterOf(rows('60b89b96', 'ce4e6e33'));
    together(owner, '60b89b96', 'ce4e6e33');
  });

  it('UDC Highlanders: Kategorie-Anhang der Quelle am Titel', () => {
    const { owner } = clusterOf(rows('f57345fd', '255e35f7', '16b9e764', '58a06305'));
    together(owner, 'f57345fd', '255e35f7');
    together(owner, '16b9e764', '58a06305');
    apart(owner, 'f57345fd', '16b9e764');
  });

  it('Punschstand: gleiche Vereine zusammen, anderer Verein bleibt eigenes Event', () => {
    const { owner } = clusterOf(rows('b42affac', '23d0ff32', '29c4228e', '83289c84', 'b3367a56'));
    together(owner, '23d0ff32', '29c4228e');
    together(owner, '83289c84', 'b3367a56');
    apart(owner, 'b42affac', '23d0ff32');
    apart(owner, 'b42affac', '83289c84');
  });
});

describe('Golden-Set: verschiedene Events bleiben getrennt', () => {
  it('Kindertheater Papperlapapp: 13:00 und 15:30 sind zwei Vorstellungen', () => {
    const { owner } = clusterOf(rows('898892be', '93be38f2', '4e163547'));
    together(owner, '93be38f2', '4e163547');
    apart(owner, '898892be', '93be38f2');
  });

  it('Masters of Dirt: je Vorstellung ein Cluster, Nachmittag und Abend getrennt', () => {
    const day12 = clusterOf(rows('47c3c133', '73021967', 'a517f9e6')).owner;
    together(day12, '47c3c133', '73021967', 'a517f9e6');
    expect(day12.get('47c3c133')).toBe('a517f9e6');

    const day13 = clusterOf(rows('48ef4da8', 'f921c796', '90405e21', '7d00e123', '41ee9f85', '180e1d89')).owner;
    together(day13, '48ef4da8', '90405e21', '41ee9f85');
    together(day13, 'f921c796', '7d00e123', '180e1d89');
    apart(day13, '48ef4da8', 'f921c796');
  });

  it('Sarah Bosetti: anderes Programm am selben Abend wird nicht automatisch verschmolzen', () => {
    const { owner, result } = clusterOf(rows('5d2a7ecd', '04ba9348'));
    apart(owner, '5d2a7ecd', '04ba9348');
    // … aber zur Prüfung vorgemerkt.
    expect(result.pairs.some(p => p.breakdown.decision === 'uncertain')).toBe(true);
  });
});

describe('Golden-Set: Tagesgruppen nach Wiener Kalendertag', () => {
  it('Platzhalter 00:00Z und echte Abendzeit landen im selben Tag', () => {
    const days = groupByViennaDay(rows('3ba91446', '3f2864bf', '23d5e9a9', '22c78230', '9d7ac9f7'));
    expect([...days.keys()]).toEqual(['2026-10-07']);
  });

  it('Wien-Mitternacht (22:00Z am Vortag) zählt zum Wiener Tag', () => {
    const base = rows('23d5e9a9')[0];
    const formB = { ...base, id: 'formb', start_date: '2026-10-06T22:00:00+00:00' };
    const days = groupByViennaDay([base, formB]);
    expect(days.get('2026-10-07')?.map(e => e.id).sort()).toEqual([base.id, 'formb'].sort());
  });
});

describe('Golden-Set: Ergebnis hängt nur von den Daten ab', () => {
  it('umgekehrte Ladereihenfolge ergibt dieselben Cluster und Primaries', () => {
    for (const [, events] of groupByViennaDay(ALL)) {
      const shape = (list: EventRow[]) => dedupDay(list.map(e => ({ ...e }))).clusters
        .map(c => `${c.primaryId}:${[...c.memberIds].sort().join(',')}`)
        .sort();
      expect(shape([...events].reverse())).toEqual(shape(events));
    }
  });
});
