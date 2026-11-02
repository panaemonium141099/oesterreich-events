/**
 * Post-Processing für den DE-Nachtlauf (fn-29.18): Dedup-Ventil je Land,
 * Dedup-Audit je Land, Abdeckung je Land und Integration.
 */
import { describe, expect, it } from 'vitest';
import { checkSafetyValve, splitPlanByCountry, type DedupPlan } from '@/lib/pipeline/dedup-plan';
import { auditByCountry, findResidualDuplicates } from '@/lib/pipeline/dedup-audit';
import { buildCoverage, coverageTable } from '@/lib/pipeline/coverage';
import type { EventRow } from '@/lib/pipeline/types';

describe('splitPlanByCountry', () => {
  it('teilt Duplikate, Freigaben und Primaries nach dem Land der eigenen Zeile', () => {
    const plan: DedupPlan = {
      markDuplicate: [
        { id: 'at1', primaryId: 'at0', clusterId: 'c1', score: 1, isNew: true },
        { id: 'de1', primaryId: 'de0', clusterId: 'c2', score: 1, isNew: true },
        { id: 'de2', primaryId: 'de0', clusterId: 'c2', score: 1, isNew: true },
      ],
      release: [{ id: 'de3', previousPrimaryId: 'de0', reason: 'different_showtime' }],
      primaries: [{ id: 'at0', clusterId: 'c1', enrichments: {} }, { id: 'de0', clusterId: 'c2', enrichments: {} }],
    };
    const by = splitPlanByCountry(plan, id => id.slice(0, 2).toUpperCase());
    expect(by.get('AT')!.markDuplicate.map(m => m.id)).toEqual(['at1']);
    expect(by.get('DE')!.markDuplicate.map(m => m.id)).toEqual(['de1', 'de2']);
    expect(by.get('DE')!.release.map(r => r.id)).toEqual(['de3']);
    expect(by.get('AT')!.primaries.map(p => p.id)).toEqual(['at0']);
  });

  it('ein DE-Zulauf über der Grenze stoppt nur Deutschland', () => {
    const markDuplicate = Array.from({ length: 5 }, (_, i) => ({ id: `de${i}`, primaryId: 'de-p', clusterId: 'c', score: 1, isNew: true }));
    const plan: DedupPlan = { markDuplicate: [...markDuplicate, { id: 'at1', primaryId: 'at-p', clusterId: 'a', score: 1, isNew: true }], release: [], primaries: [] };
    const by = splitPlanByCountry(plan, id => (id.startsWith('de') ? 'DE' : 'AT'));
    const limits = { maxNewDuplicates: 2, maxReleases: 10 };
    expect(checkSafetyValve(by.get('DE')!, limits)).toHaveLength(1);
    expect(checkSafetyValve(by.get('AT')!, limits)).toEqual([]);
  });
});

const PLACE = { location_name: 'Bürgerhaus', postal_code: '24576', latitude: 53.92, longitude: 9.89, location_precision: 'building' };
const ev = (o: Partial<EventRow> & { id: string; source_name: string }): EventRow =>
  ({ title: 'Laternenumzug', start_date: '2026-11-11T17:00:00Z', publish_status: 'published', country: 'DE', ...PLACE, ...o }) as EventRow;

describe('auditByCountry', () => {
  it('Grenze für Deutschland je sichtbarem Event wie Österreich, mindestens 10', () => {
    const at = Array.from({ length: 1000 }, (_, i) => ev({ id: `at${i}`, source_name: 'x', country: 'AT', title: `T${i}` }));
    const de = Array.from({ length: 3000 }, (_, i) => ev({ id: `de${i}`, source_name: 'y', title: `D${i}` }));
    const dup = [ev({ id: 'd1', source_name: 'de-ionas' }), ev({ id: 'd2', source_name: 'de-tribe' })];
    const events = [...at, ...de, ...dup];
    const audit = auditByCountry(events, findResidualDuplicates(events), 100);
    expect(audit.map(a => a.country)).toEqual(['AT', 'DE']);
    expect(audit[0]).toMatchObject({ visible: 1000, residual: 0, limit: 100 });
    expect(audit[1]).toMatchObject({ visible: 3002, residual: 1, limit: 301 });
  });
});

describe('buildCoverage', () => {
  const gemeinden = [
    { id: '101', country: 'AT', region: 'burgenland' },
    { id: '102', country: 'AT', region: 'burgenland' },
    { id: '01001000', country: 'DE', region: 'schleswig-holstein' },
    { id: '09162000', country: 'DE', region: 'bayern' },
  ];
  const events = [
    { country: 'AT', source_name: 'gem2go', gemeindeId: '101' },
    { country: 'DE', source_name: 'Eventim', gemeindeId: '09162000' },
    { country: 'DE', source_name: 'de-ikiss', gemeindeId: '01001000' },
    { country: 'DE', source_name: 'de-ionas', gemeindeId: null },
  ];
  const report = buildCoverage(gemeinden, events, [
    { integration: 'ikiss', adapter: 'de-ikiss', gemeindeIds: ['01001000'] },
    { integration: 'ionas', adapter: 'de-ionas', gemeindeIds: ['09162000', '09162000'] },
  ]);

  it('je Land und Bundesland: Gemeinden mit mindestens einem Termin, gleich aus welcher Quelle', () => {
    expect(report.countries).toEqual([
      { key: 'AT', gemeinden: 2, mitTermin: 1, anteil: 50 },
      { key: 'DE', gemeinden: 2, mitTermin: 2, anteil: 100 },
    ]);
    expect(report.regions.DE.map(r => r.key)).toEqual(['bayern', 'schleswig-holstein']);
  });

  it('je Integration zählen nur Termine des Adapters (Eventim deckt ionas nicht ab)', () => {
    expect(report.integrations).toEqual([
      { key: 'ikiss (de-ikiss)', gemeinden: 1, mitTermin: 1, anteil: 100 },
      { key: 'ionas (de-ionas)', gemeinden: 1, mitTermin: 0, anteil: 0 },
    ]);
    expect(coverageTable('Je Land', report.countries)).toContain('| DE | 2 | 2 | 100 % |');
  });
});
