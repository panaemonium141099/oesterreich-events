/**
 * Nur Österreich: Detailseite, Modal und ihre Nebensektionen spielen kein
 * Event aus Deutschland oder der Schweiz aus.
 *
 * Prod 2026-10-07: Die Seite eines Kabarettabends in Rosenheim lieferte 200
 * mit Titel und JSON-LD, sechs Slugs gab es zugleich als vergangenes AT-
 * und kommendes DE-Event (der Slug-Fallback konnte die DE-Zeile wählen),
 * und vergangene AT-Seiten verlinkten als „Nächste Ausgabe" einen
 * deutschen Termin.
 *
 * Die Loader laufen gegen eine In-Memory-Tabelle, die die benutzten
 * PostgREST-Filter nachbildet. Ein Filter, den der Code nicht setzt, wirkt
 * hier also auch nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

type Row = Record<string, unknown> & { id: string };
type Call = { table: string; eq: Array<[string, unknown]> };

const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost';
  return {
    rows: [] as Array<Record<string, unknown> & { id: string }>,
    calls: [] as Array<{ table: string; eq: Array<[string, unknown]> }>,
  };
});

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock('@supabase/supabase-js', () => {
  function query(table: string) {
    const call: Call = { table, eq: [] };
    db.calls.push(call);
    const preds: Array<(r: Row) => boolean> = [];
    const orders: Array<{ col: string; asc: boolean }> = [];
    let lim = Infinity;
    let single = false;
    const s = (v: unknown) => String(v ?? '');
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (call.eq.push([c, v]), preds.push(r => r[c] === v), q),
      neq: (c: string, v: unknown) => (preds.push(r => r[c] !== v), q),
      gte: (c: string, v: unknown) => (preds.push(r => s(r[c]) >= s(v)), q),
      gt: (c: string, v: unknown) => (preds.push(r => s(r[c]) > s(v)), q),
      lt: (c: string, v: unknown) => (preds.push(r => s(r[c]) < s(v)), q),
      lte: (c: string, v: unknown) => (preds.push(r => s(r[c]) <= s(v)), q),
      in: (c: string, vs: unknown[]) => (preds.push(r => vs.includes(r[c])), q),
      ilike: (c: string, pattern: string) => {
        const needle = pattern.replace(/%/g, '').toLowerCase();
        preds.push(r => s(r[c]).toLowerCase().includes(needle));
        return q;
      },
      not: (c: string, op: string, v: unknown) => {
        if (op === 'is' && v === null) preds.push(r => r[c] != null);
        return q;
      },
      order: (col: string, opts?: { ascending?: boolean }) => (
        orders.push({ col, asc: opts?.ascending !== false }), q
      ),
      limit: (n: number) => ((lim = n), q),
      single: () => ((single = true), q),
      then: (resolve: (v: unknown) => unknown) => {
        const data = db.rows.filter(r => preds.every(p => p(r)));
        data.sort((a, b) => {
          for (const { col, asc } of orders) {
            const x = a[col];
            const y = b[col];
            if (x === y) continue;
            const lt = typeof x === 'number' && typeof y === 'number' ? x < y : s(x) < s(y);
            return (lt ? -1 : 1) * (asc ? 1 : -1);
          }
          return 0;
        });
        const out = data.slice(0, lim);
        if (single) {
          return resolve(
            out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: 'no row' } },
          );
        }
        return resolve({ data: out, error: null });
      },
    };
    return q;
  }
  return { createClient: () => ({ from: (table: string) => query(table) }) };
});

// Nebensektionen der Related-Komponente laden selbst Daten; hier zählt nur
// die Related-Abfrage.
vi.mock('@/components/Activities/NearbyActivitiesSection', () => ({ EventNearbyActivities: () => null }));
vi.mock('@/components/Affiliate/TourBox', () => ({ TourBox: () => null }));
vi.mock('@/components/Events/v4/V4NearbyStays', () => ({ V4NearbyStays: () => null }));
vi.mock('@/components/Events/EventImage', () => ({ EventImage: () => null }));

import {
  parseSlugArray,
  resolveEvent,
  resolveDuplicateRedirect,
  getSuccessorEvent,
} from '@/lib/events/event-detail-loaders';
import { V4RelatedEvents } from '@/components/Events/v4/V4RelatedEvents';
import { SITE_COUNTRY } from '@/lib/site-country';
import type { Event } from '@/types/events';

const AT_ID = '685a2c6b-56e8-44ee-9dad-2bc3d8982941';
const DE_ID = 'ab6d57f0-0c5d-4a78-9920-cfbef3e6a9e3';
const CH_ID = 'cc0d57f0-0c5d-4a78-9920-cfbef3e6a9e3';

function ev(over: Partial<Row> & { id: string }): Row {
  return {
    title: 'The Music of Hans Zimmer',
    slug: 'the-music-of-hans-zimmer',
    start_date: '2026-10-17T18:00:00+00:00',
    end_date: null,
    postal_code: '8750',
    location_name: 'Stadthalle Judenburg',
    address: '8750 Judenburg',
    bundesland: 'steiermark',
    category: 'Musik',
    image_url: null,
    country: SITE_COUNTRY,
    visibility: 'public',
    publish_status: 'published',
    duplicate_of: null,
    event_score: 50,
    ...over,
  };
}

/** Eine ausländische Zeile, wie der Eventim-Feed sie liefert (bundesland NULL). */
function foreign(over: Partial<Row> & { id: string }): Row {
  return ev({
    postal_code: '83022',
    location_name: 'Kultur- und Kongresszentrum Rosenheim',
    address: '83022 Rosenheim',
    bundesland: null,
    country: 'DE',
    event_score: 90,
    ...over,
  });
}

const resolvePath = (path: string) =>
  resolveEvent(parseSlugArray(path.replace(/^\/events\//, '').split('/')));

beforeEach(() => {
  db.rows.length = 0;
  db.calls.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Detailseite: ausländische Events werden nicht aufgelöst', () => {
  it('Slug+Tag einer DE-Zeile ergibt kein Event (Seite, Metadata und Modal: 404)', async () => {
    db.rows.push(foreign({ id: DE_ID, slug: 'vince-ebert-vince-of-change-rosenheim', start_date: '2026-10-10T18:00:00+00:00' }));
    expect(await resolvePath('/events/0000-at/2026-10-10/vince-ebert-vince-of-change-rosenheim')).toBeNull();
  });

  it('CH-Zeile ebenso', async () => {
    db.rows.push(foreign({ id: CH_ID, country: 'CH', postal_code: '8001', slug: 'zuerich-konzert' }));
    expect(await resolvePath('/events/0000-at/2026-10-17/zuerich-konzert')).toBeNull();
  });

  it('Kurz-ID-URL (Legacy) einer DE-Zeile ergibt kein Event', async () => {
    db.rows.push(foreign({ id: DE_ID }));
    expect(await resolvePath(`/events/${DE_ID.slice(0, 8)}-the-music-of-hans-zimmer`)).toBeNull();
    expect(await resolvePath(`/events/83022-rosenheim/the-music-of-hans-zimmer-${DE_ID.slice(0, 8)}`)).toBeNull();
  });

  it('gleicher Slug am angefragten Tag in DE, in AT an einem anderen Tag: die AT-Zeile gewinnt', async () => {
    db.rows.push(
      foreign({ id: DE_ID, start_date: '2026-10-17T18:00:00+00:00', event_score: 99 }),
      ev({ id: AT_ID, start_date: '2026-11-20T18:00:00+00:00', event_score: 10 }),
    );
    const event = await resolvePath('/events/8750-judenburg/2026-10-17/the-music-of-hans-zimmer');
    expect(event?.id).toBe(AT_ID);
  });

  it('gleicher Slug am selben Tag in AT und DE: die AT-Zeile gewinnt trotz niedrigerem Score', async () => {
    db.rows.push(
      foreign({ id: DE_ID, event_score: 99 }),
      ev({ id: AT_ID, event_score: 10 }),
    );
    const event = await resolvePath('/events/8750-judenburg/2026-10-17/the-music-of-hans-zimmer');
    expect(event?.id).toBe(AT_ID);
  });

  it('vergangene Ausgaben: der Slug-Fallback nimmt die AT-Zeile, auch wenn die DE-Zeile jünger ist', async () => {
    db.rows.push(
      ev({ id: AT_ID, start_date: '2026-03-01T18:00:00+00:00' }),
      foreign({ id: DE_ID, start_date: '2026-09-01T18:00:00+00:00' }),
    );
    const event = await resolvePath('/events/8750-judenburg/2025-12-24/the-music-of-hans-zimmer');
    expect(event?.id).toBe(AT_ID);
  });

  it('Dublette mit ausländischem Primary: keine Weiterleitung (404)', async () => {
    db.rows.push(
      foreign({ id: DE_ID, slug: 'primary-in-rosenheim' }),
      ev({ id: AT_ID, slug: 'dublette-in-judenburg', publish_status: 'duplicate', duplicate_of: DE_ID }),
    );
    const path = '/events/8750-judenburg/2026-10-17/dublette-in-judenburg';
    const event = await resolvePath(path);
    expect(event?.publish_status).toBe('duplicate');
    expect(await resolveDuplicateRedirect(event as Event, path)).toBeNull();
  });

  it('DE-Dublette eines AT-Events behält ihren 308 auf das österreichische Primary', async () => {
    db.rows.push(
      ev({ id: AT_ID, slug: 'primary-in-judenburg' }),
      foreign({ id: DE_ID, slug: 'dublette-de', publish_status: 'duplicate', duplicate_of: AT_ID }),
    );
    const path = '/events/83022-rosenheim/2026-10-17/dublette-de';
    const event = await resolvePath(path);
    expect(event?.id).toBe(DE_ID);
    expect(await resolveDuplicateRedirect(event as Event, path)).toBe(
      '/events/8750-judenburg/2026-10-17/primary-in-judenburg',
    );
  });

  it('jede Abfrage, die für Besucher ein lebendes Event auflöst, setzt den Länderfilter', async () => {
    db.rows.push(ev({ id: AT_ID }));
    await resolvePath('/events/8750-judenburg/2026-10-18/gibts-nicht');
    await resolvePath(`/events/${AT_ID.slice(0, 8)}-x`);
    await getSuccessorEvent('the-music-of-hans-zimmer', 'The Music of Hans Zimmer', 'Stadthalle Judenburg');
    const live = db.calls.filter(c => !c.eq.some(([col, v]) => col === 'publish_status' && v === 'duplicate'));
    expect(live.length).toBeGreaterThanOrEqual(5);
    for (const call of live) {
      expect(call.table).toBe('events');
      expect(call.eq).toContainEqual(['country', SITE_COUNTRY]);
    }
  });
});

describe('Vergangene Seite: „Nächste Ausgabe" nur in Österreich', () => {
  it('Slug-Zweig überspringt den früheren DE-Termin und nimmt den AT-Termin', async () => {
    db.rows.push(
      foreign({ id: DE_ID, start_date: '2026-10-05T18:00:00+00:00' }),
      ev({ id: AT_ID, start_date: '2027-02-01T18:00:00+00:00' }),
    );
    const next = await getSuccessorEvent('the-music-of-hans-zimmer', 'The Music of Hans Zimmer', 'Stadthalle Judenburg');
    expect(next?.id).toBe(AT_ID);
  });

  it('nur ein DE-Nachfolger: kein Hinweis', async () => {
    db.rows.push(foreign({ id: DE_ID, start_date: '2026-10-05T18:00:00+00:00' }));
    expect(
      await getSuccessorEvent('the-music-of-hans-zimmer', 'The Music of Hans Zimmer', 'Stadthalle Judenburg'),
    ).toBeNull();
  });

  it('Titel+Ort-Zweig überspringt den DE-Termin und nimmt den AT-Termin', async () => {
    const markt = { slug: 'anderer-slug', title: '45. Hinterglemmer Bauernmarkt', location_name: 'Dorfplatz' };
    db.rows.push(foreign({ id: DE_ID, ...markt, start_date: '2026-10-05T18:00:00+00:00' }));
    const succ = () => getSuccessorEvent('44-hinterglemmer-bauernmarkt', '44. Hinterglemmer Bauernmarkt', 'Dorfplatz');
    expect(await succ()).toBeNull();
    db.rows.push(ev({ id: AT_ID, ...markt, start_date: '2027-05-01T08:00:00+00:00' }));
    expect((await succ())?.id).toBe(AT_ID);
  });
});

describe('„Das könnte dich auch interessieren": nur österreichische Events', () => {
  it('Stufe 3 (österreichweit, ohne Bundesland) zeigt keine DE/CH-Events', async () => {
    const event = ev({ id: AT_ID, bundesland: null, postal_code: null, category: null }) as unknown as Event;
    db.rows.push(
      foreign({ id: 'de000001-0000-4000-8000-000000000000', title: 'Rosenheim Konzert', slug: 'rosenheim-konzert', start_date: '2026-10-02T18:00:00+00:00' }),
      foreign({ id: 'ch000001-0000-4000-8000-000000000000', title: 'Zürich Konzert', slug: 'zuerich-konzert', country: 'CH', start_date: '2026-10-03T18:00:00+00:00' }),
      ev({ id: 'a7000001-0000-4000-8000-000000000000', title: 'Grazer Herbstfest', slug: 'grazer-herbstfest', start_date: '2026-10-04T18:00:00+00:00' }),
      ev({ id: 'a7000002-0000-4000-8000-000000000000', title: 'Linzer Klangwolke', slug: 'linzer-klangwolke', start_date: '2026-10-05T18:00:00+00:00' }),
    );
    const { container } = render(await V4RelatedEvents({ event }));
    const html = container.innerHTML;
    expect(html).toContain('Grazer Herbstfest');
    expect(html).toContain('Linzer Klangwolke');
    expect(html).not.toContain('Rosenheim Konzert');
    expect(html).not.toContain('Zürich Konzert');
  });

  it('alle Stufen filtern auf das Land der Seite', async () => {
    const event = ev({ id: AT_ID }) as unknown as Event;
    render(await V4RelatedEvents({ event }));
    const related = db.calls.filter(c => c.table === 'events');
    // Stufe 1 (Kategorie), 2 (Bundesland) und 3 (österreichweit) laufen,
    // weil die Tabelle außer dem Event selbst nichts enthält.
    expect(related).toHaveLength(3);
    for (const call of related) expect(call.eq).toContainEqual(['country', SITE_COUNTRY]);
  });
});
