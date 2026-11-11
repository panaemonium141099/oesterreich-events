import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import type { EventimArtist } from '@/lib/eventim/types';
import type { EventimArtistsByEvent } from '@/lib/eventim/parse';
import { syncEventArtists, dedupeArtistRows, type EventArtistRow } from '@/lib/db/event-artists-sync';

/**
 * Künstler-Schritt des Eventim-Imports (fn-30): Event-IDs in Stücken von
 * höchstens 200 auflösen, event_artists in Batches von höchstens 500 ohne
 * doppelte Schlüssel upserten, je Event die Zeilen löschen, die der Feed
 * nicht mehr nennt. Ein Fehler lässt den Event-Upsert gültig.
 */

const ev = (source_id: string, source_name = 'Eventim') =>
  ({ source_name, source_id, title: source_id, start_date: '2026-11-01T19:00:00.000Z' }) as ScrapedEvent;

const artist = (artistId: string, artistName = artistId): EventimArtist => ({ artistId, artistName });

interface FakeOptions {
  /** source_id → id der Zeile in events */
  ids: Record<string, string>;
  /** Bestand in event_artists */
  existing?: Array<{ event_id: string; artist_id: string }>;
  failUpsert?: boolean;
  failDelete?: boolean;
}

/** Minimaler PostgREST-Fake: zeichnet Chunks, Batches und Löschungen auf. */
function fakeClient(o: FakeOptions) {
  const calls = {
    inSizes: { source_id: [] as number[], event_id: [] as number[], artist_id: [] as number[] },
    upserts: [] as Array<{ rows: EventArtistRow[]; onConflict?: string }>,
    deletes: [] as Array<{ event_id: string; artist_ids: string[] }>,
    ranges: [] as Array<[number, number]>,
  };
  const existing = o.existing ?? [];
  const client = {
    from(table: string) {
      return {
        select() {
          const f: { sourceName?: string; sourceIds?: string[]; eventIds?: string[]; range?: [number, number] } = {};
          const q = {
            eq(col: string, v: string) { if (col === 'source_name') f.sourceName = v; return q; },
            in(col: string, ids: string[]) {
              if (col === 'source_id') { f.sourceIds = ids; calls.inSizes.source_id.push(ids.length); }
              if (col === 'event_id') { f.eventIds = ids; calls.inSizes.event_id.push(ids.length); }
              return q;
            },
            order() { return q; },
            range(from: number, to: number) { f.range = [from, to]; calls.ranges.push([from, to]); return q; },
            then(resolve: (r: { data: unknown[]; error: null }) => void) {
              if (table === 'events') {
                const data = (f.sourceIds ?? [])
                  .filter((sid) => o.ids[sid] && f.sourceName === 'Eventim')
                  .map((sid) => ({ id: o.ids[sid], source_id: sid }));
                resolve({ data, error: null });
                return;
              }
              const all = existing.filter((r) => (f.eventIds ?? []).includes(r.event_id));
              const [from, to] = f.range ?? [0, all.length - 1];
              resolve({ data: all.slice(from, to + 1), error: null });
            },
          };
          return q;
        },
        upsert(rows: EventArtistRow[], opts?: { onConflict?: string }) {
          calls.upserts.push({ rows, onConflict: opts?.onConflict });
          return Promise.resolve({ error: o.failUpsert ? { message: 'relation "event_artists" does not exist' } : null });
        },
        delete() {
          const d = { event_id: '', artist_ids: [] as string[] };
          const q = {
            eq(col: string, v: string) { if (col === 'event_id') d.event_id = v; return q; },
            in(col: string, ids: string[]) {
              if (col === 'artist_id') { d.artist_ids = ids; calls.inSizes.artist_id.push(ids.length); }
              calls.deletes.push(d);
              return q;
            },
            then(resolve: (r: { error: { message: string } | null }) => void) {
              resolve({ error: o.failDelete ? { message: 'permission denied' } : null });
            },
          };
          return q;
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const NOW = '2026-10-29T12:00:00.000Z';

describe('syncEventArtists', () => {
  it('löst IDs in Stücken ≤ 200 auf und schreibt Batches ≤ 500 ohne doppelte Schlüssel mit onConflict', async () => {
    const n = 450;
    const events = Array.from({ length: n }, (_, i) => ev(`E${i}`));
    // Dieselbe source_id ein zweites Mal im Lauf darf keine zweite Zeile im Batch erzeugen.
    events.push(ev('E7'));
    const ids = Object.fromEntries(events.map((e) => [e.source_id, `uuid-${e.source_id}`]));
    const artists: EventimArtistsByEvent = new Map(events.map((e) => [e.source_id, [artist('A'), artist('B')]]));
    const { client, calls } = fakeClient({ ids });

    const r = await syncEventArtists(client, events, artists, { now: () => NOW });

    expect(r).toEqual({ eventsWithArtists: n, resolved: n, unresolved: 0, written: n * 2, deleted: 0, batches: 2 });
    expect(calls.inSizes.source_id).toEqual([200, 200, 50]);
    expect(calls.inSizes.event_id).toEqual([200, 200, 50]);
    expect(calls.upserts.map((u) => u.rows.length)).toEqual([500, 400]);
    for (const u of calls.upserts) {
      expect(u.onConflict).toBe('event_id,artist_id');
      const keys = u.rows.map((row) => `${row.event_id}/${row.artist_id}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const first = calls.upserts[0].rows[0];
    expect(first).toEqual({
      event_id: 'uuid-E0', artist_id: 'A', artist_name: 'A', artist_image: null, evo_link: null,
      source: 'eventim', updated_at: NOW,
    });
    expect(calls.deletes).toEqual([]);
  });

  it('löscht je importiertem Event die Zeilen, die der Feed nicht mehr nennt, auch wenn er gar keine mehr nennt', async () => {
    const events = [ev('E1'), ev('E2'), ev('E3')];
    const ids = { E1: 'u1', E2: 'u2', E3: 'u3' };
    const existing = [
      { event_id: 'u1', artist_id: 'ART-1' },
      { event_id: 'u1', artist_id: 'ART-OLD' },
      { event_id: 'u2', artist_id: 'ART-X' },
      { event_id: 'u3', artist_id: 'ART-3' },
      // Fremdes Event (nicht im Import): bleibt unberührt.
      { event_id: 'u9', artist_id: 'ART-9' },
    ];
    const artists: EventimArtistsByEvent = new Map([
      ['E1', [artist('ART-1', 'Bilderbuch'), artist('ART-2', 'Wanda')]],
      ['E3', [artist('ART-3')]],
    ]);
    const { client, calls } = fakeClient({ ids, existing });

    const r = await syncEventArtists(client, events, artists, { now: () => NOW });

    expect(r.written).toBe(3);
    expect(r.deleted).toBe(2);
    expect(r.eventsWithArtists).toBe(2);
    expect(calls.deletes.map((d) => [d.event_id, d.artist_ids]).sort()).toEqual([
      ['u1', ['ART-OLD']],
      ['u2', ['ART-X']],
    ]);
  });

  it('übergeht Events ohne Zeile in der Datenbank (verworfen oder in Quarantäne) und zählt sie', async () => {
    const events = [ev('E1'), ev('MISSING'), ev('fremd', 'gem2go')];
    const artists: EventimArtistsByEvent = new Map([['E1', [artist('A')]], ['MISSING', [artist('B')]]]);
    const { client, calls } = fakeClient({ ids: { E1: 'u1' } });

    const r = await syncEventArtists(client, events, artists);

    expect(r.resolved).toBe(1);
    expect(r.unresolved).toBe(1);
    expect(calls.upserts.flatMap((u) => u.rows).map((row) => row.event_id)).toEqual(['u1']);
  });

  it('tut ohne Eventim-Events nichts', async () => {
    const { client, calls } = fakeClient({ ids: {} });
    const r = await syncEventArtists(client, [ev('x', 'gem2go')], new Map());
    expect(r).toEqual({ eventsWithArtists: 0, resolved: 0, unresolved: 0, written: 0, deleted: 0, batches: 0 });
    expect(calls.inSizes.source_id).toEqual([]);
  });

  it('wirft bei einem Datenbankfehler, statt still ein Teilergebnis zu melden', async () => {
    const { client } = fakeClient({ ids: { E1: 'u1' }, failUpsert: true });
    await expect(syncEventArtists(client, [ev('E1')], new Map([['E1', [artist('A')]]])))
      .rejects.toThrow(/event_artists.*does not exist/);
  });
});

describe('dedupeArtistRows', () => {
  it('behält je (event_id, artist_id) die erste Zeile', () => {
    const rows = [
      { event_id: 'u1', artist_id: 'A', n: 1 },
      { event_id: 'u1', artist_id: 'A', n: 2 },
      { event_id: 'u1', artist_id: 'B', n: 3 },
      { event_id: 'u2', artist_id: 'A', n: 4 },
    ];
    expect(dedupeArtistRows(rows).map((r) => r.n)).toEqual([1, 3, 4]);
  });
});

// upsertEventimEvents: der Künstler-Schritt läuft nach dem Event-Upsert und
// nimmt ihn bei einem Fehler nicht zurück.
const syncMock = vi.hoisted(() => ({
  syncEventsToSupabase: vi.fn(),
  beginScrapeRun: vi.fn(async () => null),
  finishScrapeRun: vi.fn(async () => {}),
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('@/lib/db/supabase-sync', () => syncMock);

describe('upsertEventimEvents mit Künstlern', () => {
  beforeEach(() => {
    syncMock.syncEventsToSupabase.mockReset();
    syncMock.getSupabaseAdminClient.mockReset();
    syncMock.syncEventsToSupabase.mockImplementation(async (events: ScrapedEvent[]) => ({
      upserted: events.length, errors: 0, filtered: 0, quarantined: 0, rawWritten: events.length, errorMessages: [],
    }));
  });

  it('schreibt die Künstler nach dem Event-Upsert', async () => {
    const { upsertEventimEvents } = await import('@/lib/eventim/import');
    const { client, calls } = fakeClient({ ids: { E1: 'u1' } });
    syncMock.getSupabaseAdminClient.mockReturnValue(client);
    const logs: string[] = [];

    const r = await upsertEventimEvents([ev('E1')], (m) => logs.push(m), { artists: new Map([['E1', [artist('A')]]]) });

    expect(r.upserted).toBe(1);
    expect(r.artistsError).toBeUndefined();
    expect(r.artists?.written).toBe(1);
    expect(calls.upserts).toHaveLength(1);
    expect(logs.some((l) => /Künstler: 1 Events mit Künstlern/.test(l))).toBe(true);
  });

  it('meldet einen Fehler des Künstler-Schritts, ohne den Event-Upsert zurückzunehmen', async () => {
    const { upsertEventimEvents } = await import('@/lib/eventim/import');
    const { client } = fakeClient({ ids: { E1: 'u1' }, failUpsert: true });
    syncMock.getSupabaseAdminClient.mockReturnValue(client);

    const r = await upsertEventimEvents([ev('E1'), ev('E2')], () => {}, { artists: new Map([['E1', [artist('A')]]]) });

    expect(r.upserted).toBe(2);
    expect(r.errors).toBe(0);
    expect(r.artists).toBeUndefined();
    expect(r.artistsError).toMatch(/does not exist/);
  });

  it('lässt event_artists ohne übergebene Künstler unberührt', async () => {
    const { upsertEventimEvents } = await import('@/lib/eventim/import');
    const r = await upsertEventimEvents([ev('E1')]);
    expect(r).toEqual({ upserted: 1, errors: 0, filtered: 0, batches: 1 });
    expect(syncMock.getSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
