import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Batch-Übersetzung — die Buchführung, nicht der Prompt.
 *
 * Getestet wird, was den Backfill kaputt machen könnte: dass ein Event nie
 * doppelt bezahlt wird, dass ein stiller Supabase-Write-Fehler als Fehler
 * zählt (supabase-js wirft dabei nicht) und dass die Deadline greift.
 */

const translateMock = vi.fn();
vi.mock('@/lib/i18n/translate-event', () => ({
  translateViaGemini: (...args: unknown[]) => translateMock(...args),
}));

import { runTranslationBatch } from '@/lib/i18n/translate-batch';

type Row = { id: string; title: string | null; description: string | null; start_date: string };

/**
 * Minimaler Supabase-Stub. Bildet das nach, worauf der Batch sich verlaesst:
 * uebersetzte Zeilen fallen aus der Ergebnismenge, fehlgeschlagene bleiben
 * drin — und `.range(from, to)` schneidet daraus das angeforderte Fenster.
 */
function makeSupabase(rows: Row[], opts: { updateError?: boolean; failIds?: Set<string> } = {}) {
  const translated = new Set<string>();
  const updates: string[] = [];
  const ranges: Array<[number, number]> = [];

  const builder = () => {
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get(_t, prop) {
        if (prop === 'range') {
          return (from: number, to: number) => {
            ranges.push([from, to]);
            const open = rows.filter(r => !translated.has(r.id));
            return Promise.resolve({ data: open.slice(from, to + 1), error: null });
          };
        }
        if (prop === 'then') return undefined;
        return () => self;
      },
    });
    return self;
  };

  return {
    client: {
      from: () => ({
        select: () => builder(),
        update: () => ({
          eq: (_col: string, id: string) => {
            updates.push(id);
            if (opts.updateError) return Promise.resolve({ error: { message: 'boom' } });
            translated.add(id);
            return Promise.resolve({ error: null });
          },
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    updates,
    ranges,
  };
}

const row = (id: string, title: string | null = `Titel ${id}`): Row => ({
  id,
  title,
  description: 'Beschreibung',
  start_date: '2099-01-01',
});

beforeEach(() => {
  translateMock.mockReset();
  translateMock.mockResolvedValue({ title_en: 'Title', description_en: 'Description' });
});

describe('runTranslationBatch', () => {
  it('übersetzt jedes Event genau einmal und stoppt, wenn nichts mehr offen ist', async () => {
    const { client, updates } = makeSupabase([row('a'), row('b'), row('c')]);

    const result = await runTranslationBatch(client, 'key', { limit: 100, concurrency: 2 });

    expect(result.translated).toBe(3);
    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(updates.sort()).toEqual(['a', 'b', 'c']);
    expect(translateMock).toHaveBeenCalledTimes(3);
  });

  it('respektiert das Limit', async () => {
    const { client } = makeSupabase([row('a'), row('b'), row('c'), row('d')]);

    const result = await runTranslationBatch(client, 'key', { limit: 2, concurrency: 1 });

    expect(result.processed).toBe(2);
    expect(result.translated).toBe(2);
  });

  it('zählt einen stillen Supabase-Write-Fehler als Fehler, nicht als Erfolg', async () => {
    // supabase-js wirft bei Schreibfehlern nicht — ungeprüft würde der Lauf
    // "3 übersetzt" melden und nichts gespeichert haben.
    const { client } = makeSupabase([row('a')], { updateError: true });

    const result = await runTranslationBatch(client, 'key', { limit: 1, concurrency: 1 });

    expect(result.translated).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('zählt einen fehlgeschlagenen Gemini-Call als Fehler und schreibt nichts', async () => {
    translateMock.mockResolvedValue(null);
    const { client, updates } = makeSupabase([row('a')]);

    const result = await runTranslationBatch(client, 'key', { limit: 1, concurrency: 1 });

    expect(result.failed).toBe(1);
    expect(result.translated).toBe(0);
    expect(updates).toEqual([]);
  });

  it('überspringt Events ohne Titel, ohne sie erneut zu holen', async () => {
    // Ein titelloses Event bekommt nie ein title_en und bliebe ohne die
    // attempted-Menge für immer in der Kandidaten-Query — Endlosschleife.
    const { client } = makeSupabase([row('a', null)]);

    const result = await runTranslationBatch(client, 'key', { limit: 50, concurrency: 1 });

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(1);
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('schreibt im Dry-Run nicht', async () => {
    const { client, updates } = makeSupabase([row('a'), row('b')]);

    const result = await runTranslationBatch(client, 'key', {
      limit: 50,
      concurrency: 1,
      dryRun: true,
    });

    // Ohne Write bleiben die Zeilen "offen"; die attempted-Menge verhindert,
    // dass der Lauf sie erneut zieht.
    expect(updates).toEqual([]);
    expect(result.translated).toBe(2);
    expect(result.processed).toBe(2);
  });

  it('arbeitet weiter, wenn mehr Events fehlschlagen als eine Seite fasst', async () => {
    // Der Fehler, der am 2026-09-04 den Backfill nach 8 994 von 75 936
    // Events beendete: Fehlschlaege bleiben in der Kandidaten-Query stehen
    // und sortieren vor allem Unberuehrten. Ohne Offset lieferte die
    // Query irgendwann nur noch schon versuchte Zeilen — der Batch hielt
    // das fuer "nichts mehr offen".
    //
    // FETCH_CHUNK ist 500, also muessen hier >500 Events scheitern, bevor
    // ein einziges durchgeht.
    const FAILING = 520;
    const rows = [
      ...Array.from({ length: FAILING }, (_, i) => row(`fail-${String(i).padStart(4, '0')}`)),
      row('zzz-ok'),
    ];
    translateMock.mockImplementation((title: string) =>
      Promise.resolve(String(title).startsWith('Titel fail-')
        ? null
        : { title_en: 'Title', description_en: null }),
    );

    const { client, updates } = makeSupabase(rows);
    const result = await runTranslationBatch(client, 'key', { limit: 5000, concurrency: 8 });

    expect(result.failed).toBe(FAILING);
    expect(result.translated).toBe(1);
    expect(updates).toEqual(['zzz-ok']);
    expect(result.processed).toBe(FAILING + 1);
  });

  it('bricht bei erreichter Deadline ab', async () => {
    const { client } = makeSupabase(Array.from({ length: 20 }, (_, i) => row(`e${i}`)));
    translateMock.mockImplementation(
      () => new Promise(r => setTimeout(() => r({ title_en: 'T', description_en: null }), 20)),
    );

    const result = await runTranslationBatch(client, 'key', {
      limit: 20,
      concurrency: 1,
      deadlineMs: 40,
    });

    expect(result.stoppedByDeadline).toBe(true);
    expect(result.processed).toBeLessThan(20);
  });
});
