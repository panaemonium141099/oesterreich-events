import { describe, it, expect } from 'vitest';

/**
 * Bezirks-Ableitung fuer poi_activities.bezirk: Registry-Bezirk ->
 * kanonischer Name aus DISTRICTS_BY_BUNDESLAND (Vokabular der Event-Filter).
 */

import { activityBezirk } from '@/lib/activities/bezirk';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { bundeslandToId } from '@/lib/bundeslaender';
import { isCanonicalDistrict } from '@/lib/district-normalizer';

function byName(name: string) {
  const g = ALL_GEMEINDEN.find((x) => x.name === name);
  if (!g) throw new Error(`Registry-Gemeinde fehlt: ${name}`);
  return { gemeinde: g, bl: bundeslandToId(g.bundesland) };
}

describe('activityBezirk', () => {
  it('liefert fuer jede Registry-Zeile entweder null oder einen kanonischen Bezirk', () => {
    const nulls: string[] = [];
    for (const g of ALL_GEMEINDEN) {
      const bezirk = activityBezirk(g, bundeslandToId(g.bundesland));
      if (bezirk === null) {
        nulls.push(g.name);
        continue;
      }
      expect(isCanonicalDistrict(bezirk), `${g.name}: ${bezirk}`).toBe(true);
      expect(bezirk).toBe(bezirk.toLowerCase());
    }
    // Einzig Wien (eine Registry-Zeile fuer 23 Bezirke) bleibt ohne Bezirk.
    expect(nulls).toEqual(['Wien']);
  });

  it('nimmt die Registry-Schreibweisen ueber den Normalizer mit', () => {
    const cases: Array<[string, string]> = [
      ['Podersdorf am See', 'neusiedl am see'],
      ['Bruck an der Leitha', 'bruck an der leitha'],
      ['Krems an der Donau', 'krems (stadt)'],
      ['Eisenstadt', 'eisenstadt'],
      ['Sankt Johann im Pongau', 'sankt johann im pongau'],
    ];
    for (const [name, expected] of cases) {
      const { gemeinde, bl } = byName(name);
      expect(activityBezirk(gemeinde, bl), name).toBe(expected);
    }
  });

  it('loest die drei Registry-Sonderfaelle und die OOe-Statutarstaedte auf', () => {
    const cases: Array<[string, string]> = [
      ['Rust', 'eisenstadt'],
      ['Waidhofen an der Ybbs', 'waidhofen an der ybbs'],
      ['Innsbruck', 'innsbruck (stadt)'],
      ['Linz', 'linz (stadt)'],
      ['Steyr', 'steyr (stadt)'],
      ['Wels', 'wels (stadt)'],
    ];
    for (const [name, expected] of cases) {
      const { gemeinde, bl } = byName(name);
      expect(activityBezirk(gemeinde, bl), name).toBe(expected);
    }
  });

  it('gibt ohne Bundesland-ID oder ohne Registry-Bezirk null zurueck', () => {
    const { gemeinde } = byName('Podersdorf am See');
    expect(activityBezirk(gemeinde, null)).toBeNull();
    expect(activityBezirk({ ...gemeinde, bezirk: '  ' }, 'burgenland')).toBeNull();
    expect(activityBezirk({ ...gemeinde, bezirk: 'Kein Bezirk' }, 'burgenland')).toBeNull();
  });
});
