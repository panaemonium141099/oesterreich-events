// src/__tests__/pipeline/dedup-audit.test.ts
//
// Unabhängige Nachkontrolle nach dem Dedup: findet sichtbare Paare, die
// offensichtlich dasselbe Event sind. Schlägt Alarm, wenn der Dedup nicht
// lief, abbrach oder eine neue Quelle an ihm vorbeiläuft.

import { describe, it, expect } from 'vitest';
import { findResidualDuplicates } from '@/lib/pipeline/dedup-audit';
import type { EventRow } from '@/lib/pipeline/types';

const PLACE = { location_name: 'Sargfabrik', postal_code: '1140', latitude: 48.1952, longitude: 16.3046, location_precision: 'building' };
const ev = (o: Partial<EventRow> & { id: string; source_name: string }): EventRow =>
  ({ title: 'Fehringer´s Kalte Küche', start_date: '2026-10-07T17:30:00Z', publish_status: 'published', ...PLACE, ...o }) as EventRow;

describe('findResidualDuplicates', () => {
  it('findet zwei sichtbare Zeilen desselben Events aus verschiedenen Quellen', () => {
    const r = findResidualDuplicates([ev({ id: 'a', source_name: 'falter' }), ev({ id: 'b', source_name: 'wien-ticket', title: 'FEHRINGER´S KALTE KÜCHE' })]);
    expect(r).toHaveLength(1);
  });

  // Abschlussprüfung 2026-10-08: 210 Paare aus Feratel-Basiszeile und
  // Terminzeile waren beide sichtbar, das Audit übersprang gleiche Quellen.
  it('zählt auch dieselbe Quelle unter zwei Kennungen zur selben Minute', () => {
    const r = findResidualDuplicates([
      ev({ id: 'a', source_name: 'feratel-deskline', source_id: 'feratel-bccca177' }),
      ev({ id: 'b', source_name: 'feratel-deskline', source_id: 'feratel-bccca177:2026-10-07' }),
    ]);
    expect(r).toHaveLength(1);
  });

  it('dieselbe Quelle zu verschiedenen Minuten sind verschiedene Programmpunkte', () => {
    const r = findResidualDuplicates([
      ev({ id: 'a', source_name: 'Eventim', source_id: '22091132', start_date: '2026-10-07T17:30:00Z' }),
      ev({ id: 'b', source_name: 'Eventim', source_id: '22091134', start_date: '2026-10-07T17:40:00Z' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('ignoriert erledigte Duplikate', () => {
    const r = findResidualDuplicates([
      ev({ id: 'a', source_name: 'falter' }),
      ev({ id: 'b', source_name: 'wien-ticket', publish_status: 'duplicate', duplicate_of: 'a' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('ignoriert verschiedene Vorstellungen und manuell getrennte Paare', () => {
    expect(findResidualDuplicates([
      ev({ id: 'a', source_name: 'falter' }),
      ev({ id: 'b', source_name: 'wien-ticket', start_date: '2026-10-07T12:00:00Z' }),
    ])).toHaveLength(0);
    expect(findResidualDuplicates(
      [ev({ id: 'a', source_name: 'falter' }), ev({ id: 'b', source_name: 'wien-ticket' })],
      { manualSplits: new Set(['a:b']) },
    )).toHaveLength(0);
  });

  it('zählt die Wiener Tage, nicht die UTC-Tage', () => {
    const r = findResidualDuplicates([
      ev({ id: 'a', source_name: 'falter', start_date: '2026-10-06T22:00:00Z' }),
      ev({ id: 'b', source_name: 'wien-ticket' }),
    ]);
    expect(r).toHaveLength(1);
  });
});
