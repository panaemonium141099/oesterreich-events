import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { planSourceIdMigrations, migrateSourceIds, type LegacyRow } from '@/lib/db/source-id-migration';
import type { ScrapedEvent } from '@/types/events';

const ev = (source_id: string, start_date: string, previous_source_id?: string, source_name = 'gem2go') =>
  ({ source_name, source_id, start_date, previous_source_id }) as ScrapedEvent;
const row = (id: string, source_id: string, start_date: string, source_name = 'gem2go'): LegacyRow => ({
  id,
  source_name,
  source_id,
  start_date,
});

describe('planSourceIdMigrations', () => {
  it('gibt die alte Zeile an den Termin am selben Wiener Tag', () => {
    // Serie unter einer alten ID: die Zeile stand zuletzt auf dem 11.10.
    const events = [
      ev('gem2go-4742-111-2026-10-10', '2026-10-10T12:00:00.000Z', 'gem2go-4742-buchausstellung'),
      ev('gem2go-4742-222-2026-10-11', '2026-10-11T07:00:00.000Z', 'gem2go-4742-buchausstellung'),
    ];
    const legacy = [row('e1', 'gem2go-4742-buchausstellung', '2026-10-11T00:00:00+00:00')];
    expect(planSourceIdMigrations(events, legacy, new Set())).toEqual([
      { id: 'e1', source_name: 'gem2go', from: 'gem2go-4742-buchausstellung', to: 'gem2go-4742-222-2026-10-11' },
    ]);
  });

  it('liest den Tag der alten Zeile in Wiener Zeit', () => {
    // 22:00Z am 09.10. ist Mitternacht am 10.10. in Wien, 21:00Z noch der 09.10.
    const now = new Date('2026-10-01T10:00:00Z');
    const events = [ev('neu-2026-10-09', '2026-10-09', 'alt'), ev('neu-2026-10-10', '2026-10-10', 'alt')];
    const target = (start: string) => planSourceIdMigrations(events, [row('e1', 'alt', start)], new Set(), now)[0]?.to;
    expect(target('2026-10-09T22:00:00+00:00')).toBe('neu-2026-10-10');
    expect(target('2026-10-09T21:00:00+00:00')).toBe('neu-2026-10-09');
  });

  it('lässt vergangene Zeilen stehen', () => {
    const events = [ev('neu-2026-10-17', '2026-10-17', 'alt')];
    const now = new Date('2026-10-12T10:00:00Z');
    expect(planSourceIdMigrations(events, [row('e1', 'alt', '2026-10-10T00:00:00+00:00')], new Set(), now)).toEqual([]);
  });

  it('gibt eine künftige Zeile ohne Termin an ihrem Tag an den nächsten freien Termin', () => {
    // Prod 2026-10-07: der alte Parser las das Datum aus dem Kurztext
    // ("Anmeldung bis 09. Oktober"), der Termin ist am 10.10.
    const now = new Date('2026-10-07T10:00:00Z');
    const events = [ev('flohmarkt-2026-10-10', '2026-10-10T07:00:00.000Z', 'alt')];
    expect(planSourceIdMigrations(events, [row('e1', 'alt', '2026-10-09T00:00:00+00:00')], new Set(), now)).toEqual([
      { id: 'e1', source_name: 'gem2go', from: 'alt', to: 'flohmarkt-2026-10-10' },
    ]);
  });

  it('plant erst alle genauen Tage, dann die nächstgelegenen freien Termine', () => {
    // e2 steht auf dem 14.10. und bekommt ihn; e1 (08.10., kein Termin) den 07.10.
    const now = new Date('2026-10-01T10:00:00Z');
    const events = [ev('yoga-2026-10-07', '2026-10-07', 'alt-a'), ev('yoga-2026-10-14', '2026-10-14', 'alt-b'), ev('yoga-2026-10-21', '2026-10-21', 'alt-a')];
    const legacy = [row('e1', 'alt-a', '2026-10-08T00:00:00+00:00'), row('e2', 'alt-b', '2026-10-14T00:00:00+00:00')];
    expect(planSourceIdMigrations(events, legacy, new Set(), now).map((m) => [m.id, m.to])).toEqual([
      ['e2', 'yoga-2026-10-14'],
      ['e1', 'yoga-2026-10-07'],
    ]);
  });

  it('schlüsselt nicht um, wenn die neue ID schon eine Zeile hat', () => {
    const events = [ev('neu-2026-10-10', '2026-10-10', 'alt')];
    const legacy = [row('e1', 'alt', '2026-10-10T00:00:00+00:00')];
    expect(planSourceIdMigrations(events, legacy, new Set(['gem2go::neu-2026-10-10']))).toEqual([]);
  });

  it('vergibt jede neue ID höchstens einmal', () => {
    // Teaser- und Listenkarte hatten verschiedene alte IDs, tragen jetzt dieselbe neue.
    const events = [ev('neu-2026-10-10', '2026-10-10', 'alt-a'), ev('neu-2026-10-10', '2026-10-10', 'alt-b')];
    const legacy = [row('e1', 'alt-a', '2026-10-10T00:00:00+00:00'), row('e2', 'alt-b', '2026-10-10T00:00:00+00:00')];
    expect(planSourceIdMigrations(events, legacy, new Set()).map((m) => m.id)).toEqual(['e1']);
  });

  it('nimmt am selben Tag den Termin mit derselben Uhrzeit', () => {
    // Zwei Führungen am 18.10. unter einer alten ID, die Zeile steht auf 14:00 Wien.
    const events = [ev('fuehrung-10', '2026-10-18T08:00:00.000Z', 'alt'), ev('fuehrung-14', '2026-10-18T12:00:00.000Z', 'alt')];
    const legacy = [row('e1', 'alt', '2026-10-18T12:00:00+00:00')];
    expect(planSourceIdMigrations(events, legacy, new Set()).map((m) => m.to)).toEqual(['fuehrung-14']);
  });

  it('nimmt am selben Tag zuerst den Termin mit demselben Titel', () => {
    // Gekürzte IDs teilten sich verschiedene Events einer Seite mit gleichem
    // Anfang; die Uhrzeit des Termins hat sich verschoben.
    const titled = (id: string, start: string, title: string) => ({ ...ev(id, start, 'alt'), title }) as ScrapedEvent;
    const events = [titled('kaffee', '2026-10-16T08:00:00.000Z', 'Pensionistenverband - Kaffeeplauscherl'), titled('wurst', '2026-10-16T10:00:00.000Z', 'Pensionistenverband - Wurst, Saumeisen, Stelzen')];
    const legacy = [{ ...row('e1', 'alt', '2026-10-16T08:00:00+00:00'), title: 'Pensionistenverband - Wurst, Saumeisen, Stelzen' }];
    expect(planSourceIdMigrations(events, legacy, new Set(), new Date('2026-10-01T10:00:00Z')).map((m) => m.to)).toEqual(['wurst']);
  });

  it('gibt eine Zeile nur bei gleichem Titel an einen anderen Tag', () => {
    // Prod-Probelauf 2026-10-11 (markersdorf-haindorf.gv.at): die Zeile
    // „Wurst, Saumeisen, Stelzen" am 16.10. ging sonst an das Kaffeeplauscherl am 29.10.
    const now = new Date('2026-10-11T10:00:00Z');
    const titled = (id: string, start: string, title: string) => ({ ...ev(id, start, 'alt'), title }) as ScrapedEvent;
    const legacy = [{ ...row('e1', 'alt', '2026-10-16T00:00:00+00:00'), title: 'Pensionistenverband - Wurst, Saumeisen, Stelzen' }];
    expect(planSourceIdMigrations([titled('kaffee', '2026-10-29', 'Pensionistenverband - Kaffeeplauscherl')], legacy, new Set(), now)).toEqual([]);
    expect(planSourceIdMigrations([titled('wurst', '2026-11-13', 'Pensionistenverband -  Wurst, Saumeisen, Stelzen ')], legacy, new Set(), now).map((m) => m.to)).toEqual(['wurst']);
  });

  it('lässt eine Zeile von heute ohne Termin stehen', () => {
    // Die Seite listet den heutigen Termin nicht mehr (begonnen), die Zeile
    // gehört trotzdem zu heute (Probelauf: Kinderflohmarkt 11.10. → 14.03.2027).
    const now = new Date('2026-10-11T10:00:00Z');
    const events = [ev('flohmarkt-2027-03-14', '2027-03-14', 'alt')];
    expect(planSourceIdMigrations(events, [row('e1', 'alt', '2026-10-11T07:00:00+00:00')], new Set(), now)).toEqual([]);
  });

  it('gibt eine Zeile nie an einen Termin einer anderen Website', () => {
    // Gekürzte Registry-IDs teilten sich Gemeinden (Prod 2026-10-11: 538
    // von 13.099). Ohne Termin der eigenen Seite bleibt die Zeile stehen.
    const now = new Date('2026-10-01T10:00:00Z');
    const site = (url: string, id: string, start: string) => ({ ...ev(id, start, 'alt'), source_url: url }) as ScrapedEvent;
    const legacy = [{ ...row('e1', 'alt', '2026-10-10T00:00:00+00:00'), source_url: 'https://www.brunn-wild.gv.at/jobmesse' }];
    const elsewhere = [site('https://www.irnfritz.at/jobmesse', 'irnfritz-10', '2026-10-10'), site('https://irnfritz.at/x', 'irnfritz-11', '2026-10-11')];
    expect(planSourceIdMigrations(elsewhere, legacy, new Set(), now)).toEqual([]);
    // Dieselbe Website, auch ohne www und über http.
    const own = [...elsewhere, site('http://brunn-wild.gv.at/jobmesse-2', 'brunn-10', '2026-10-10')];
    expect(planSourceIdMigrations(own, legacy, new Set(), now).map((m) => m.to)).toEqual(['brunn-10']);
  });

  it('bleibt in der eigenen Quelle und ignoriert Events ohne alte ID', () => {
    const events = [ev('neu', '2026-10-10', 'alt'), ev('x', '2026-10-10'), ev('y', '2026-10-10', 'y')];
    const legacy = [row('e1', 'alt', '2026-10-10T00:00:00+00:00', 'gemeinde-registry')];
    expect(planSourceIdMigrations(events, legacy, new Set())).toEqual([]);
  });
});

/** Minimaler Fake: zeichnet Abfragen und Updates auf. */
function fakeClient(rows: Array<LegacyRow & { exists?: boolean }>, failUpdate = false) {
  const calls = { inSizes: [] as number[], updates: [] as Array<{ set: unknown; eq: Array<[string, unknown]> }> };
  const client = {
    from: () => ({
      select: () => {
        const filter: { name?: string; ids?: string[] } = {};
        const q = {
          eq(col: string, v: string) { if (col === 'source_name') filter.name = v; return q; },
          in(col: string, ids: string[]) { if (col === 'source_id') { filter.ids = ids; calls.inSizes.push(ids.length); } return q; },
          then(resolve: (r: { data: LegacyRow[]; error: null }) => void) {
            resolve({ data: rows.filter((r) => r.source_name === filter.name && filter.ids!.includes(r.source_id)), error: null });
          },
        };
        return q;
      },
      update: (set: unknown) => {
        const u = { set, eq: [] as Array<[string, unknown]> };
        calls.updates.push(u);
        const q = {
          eq(col: string, v: unknown) { u.eq.push([col, v]); return q; },
          then(resolve: (r: { error: { message: string } | null }) => void) {
            resolve({ error: failUpdate ? { message: 'duplicate key value' } : null });
          },
        };
        return q;
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('migrateSourceIds', () => {
  it('fragt in Stücken von höchstens 200 IDs und schreibt mit Schutz auf die alte ID', async () => {
    const events = Array.from({ length: 450 }, (_, i) => ev(`neu-${i}`, '2026-10-10', `alt-${i}`));
    const { client, calls } = fakeClient([row('e7', 'alt-7', '2026-10-10T00:00:00+00:00')]);
    const result = await migrateSourceIds(client, events);
    expect(result).toEqual({ moved: 1, failed: 0, errors: [] });
    expect(Math.max(...calls.inSizes)).toBeLessThanOrEqual(200);
    expect(calls.updates).toEqual([
      { set: { source_id: 'neu-7' }, eq: [['id', 'e7'], ['source_name', 'gem2go'], ['source_id', 'alt-7']] },
    ]);
  });

  it('zählt abgelehnte Updates, statt Erfolg zu melden', async () => {
    const { client } = fakeClient([row('e1', 'alt', '2026-10-10T00:00:00+00:00')], true);
    const result = await migrateSourceIds(client, [ev('neu', '2026-10-10', 'alt')]);
    expect(result).toEqual({ moved: 0, failed: 1, errors: ['duplicate key value'] });
  });

  it('tut ohne alte IDs nichts', async () => {
    const { client, calls } = fakeClient([]);
    expect(await migrateSourceIds(client, [ev('a', '2026-10-10')])).toEqual({ moved: 0, failed: 0, errors: [] });
    expect(calls.inSizes).toEqual([]);
  });
});
