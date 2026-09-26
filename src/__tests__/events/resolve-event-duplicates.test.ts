/**
 * Dubletten-URLs muessen per 308 zum Primary fuehren statt in ein 404.
 *
 * Bug 2026-09-26: getEventBySlugAndDate blendet `duplicate` aus (Loop-Schutz),
 * getEventBySlugOnly liest nur `published`. Hatte die Dublette einen anderen
 * Slug oder Tag als ihr Primary, fand resolveEvent nichts und der
 * Redirect-Block der Detailseite war unerreichbar (5.258 kuenftige Dubletten).
 *
 * Der Test faehrt resolveEvent + resolveDuplicateRedirect gegen eine
 * In-Memory-Tabelle, die die benutzten PostgREST-Filter nachbildet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown> & { id: string };

const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost';
  return { rows: [] as Array<Record<string, unknown> & { id: string }> };
});

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock('@supabase/supabase-js', () => {
  function query() {
    const preds: Array<(r: Row) => boolean> = [];
    let lim = Infinity;
    let single = false;
    const cmp = (a: unknown, b: unknown) => String(a ?? '').localeCompare(String(b ?? ''));
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (preds.push(r => r[c] === v), q),
      neq: (c: string, v: unknown) => (preds.push(r => r[c] !== v), q),
      gte: (c: string, v: unknown) => (preds.push(r => cmp(r[c], v) >= 0), q),
      gt: (c: string, v: unknown) => (preds.push(r => cmp(r[c], v) > 0), q),
      lt: (c: string, v: unknown) => (preds.push(r => cmp(r[c], v) < 0), q),
      lte: (c: string, v: unknown) => (preds.push(r => cmp(r[c], v) <= 0), q),
      not: (c: string, op: string, v: unknown) => {
        if (op === 'is' && v === null) preds.push(r => r[c] != null);
        return q;
      },
      order: () => q,
      limit: (n: number) => ((lim = n), q),
      single: () => ((single = true), q),
      then: (resolve: (v: unknown) => unknown) => {
        const data = db.rows.filter(r => preds.every(p => p(r))).slice(0, lim);
        if (single) {
          return resolve(
            data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'no row' } },
          );
        }
        return resolve({ data, error: null });
      },
    };
    return q;
  }
  return { createClient: () => ({ from: () => query() }) };
});

import {
  parseSlugArray,
  resolveEvent,
  resolveDuplicateRedirect,
} from '@/lib/events/event-detail-loaders';
import type { Event } from '@/types/events';

const PRIMARY_ID = '685a2c6b-56e8-44ee-9dad-2bc3d8982941';
const DUP_ID = 'ab6d57f0-0c5d-4a78-9920-cfbef3e6a9e3';

function ev(over: Partial<Row> & { id: string }): Row {
  return {
    title: 'Vegane Küche als Bereicherung',
    start_date: '2026-10-17T07:00:00+00:00',
    postal_code: '8750',
    location_name: 'Judenburg',
    address: '8750 Judenburg',
    bundesland: 'Steiermark',
    publish_status: 'published',
    duplicate_of: null,
    event_score: 50,
    ...over,
  };
}

async function redirectFor(path: string): Promise<string | null | 'no-event' | 'not-duplicate'> {
  const segs = path.replace(/^\/events\//, '').split('/');
  const event = await resolveEvent(parseSlugArray(segs));
  if (!event) return 'no-event';
  if (event.publish_status !== 'duplicate') return 'not-duplicate';
  return resolveDuplicateRedirect(event as Event, path);
}

describe('resolveEvent — Dubletten-Redirect', () => {
  beforeEach(() => {
    db.rows.length = 0;
  });

  it('Dublette mit anderem Slug: liefert die Dublette und das Primary als Ziel', async () => {
    db.rows.push(
      ev({ id: PRIMARY_ID, slug: 'kochkurs-vegane-kueche-als-bereicherung-judenburg' }),
      ev({
        id: DUP_ID,
        slug: 'vegane-kueche-als-bereicherung-judenburg',
        publish_status: 'duplicate',
        duplicate_of: PRIMARY_ID,
      }),
    );
    const path = '/events/8750-judenburg/2026-10-17/vegane-kueche-als-bereicherung-judenburg';
    const event = await resolveEvent(parseSlugArray(path.split('/').slice(2)));
    expect(event?.id).toBe(DUP_ID);
    expect(await redirectFor(path)).toBe(
      '/events/8750-judenburg/2026-10-17/kochkurs-vegane-kueche-als-bereicherung-judenburg',
    );
  });

  it('Dublette mit gleichem Slug+Tag wie das Primary: liefert das Primary, kein Loop', async () => {
    const slug = 'eisenstadt-in-weiss';
    db.rows.push(
      ev({ id: DUP_ID, slug, publish_status: 'duplicate', duplicate_of: PRIMARY_ID, event_score: 99 }),
      ev({ id: PRIMARY_ID, slug }),
    );
    const event = await resolveEvent(parseSlugArray(['8750-judenburg', '2026-10-17', slug]));
    expect(event?.id).toBe(PRIMARY_ID);
    expect(await redirectFor(`/events/8750-judenburg/2026-10-17/${slug}`)).toBe('not-duplicate');
  });

  it('folgt Ketten Dublette → Dublette → Primary', async () => {
    const midId = 'bbbbbbbb-0000-4000-8000-000000000000';
    db.rows.push(
      ev({ id: PRIMARY_ID, slug: 'primary-slug' }),
      ev({ id: midId, slug: 'mid-slug', publish_status: 'duplicate', duplicate_of: PRIMARY_ID }),
      ev({ id: DUP_ID, slug: 'dup-slug', publish_status: 'duplicate', duplicate_of: midId }),
    );
    expect(await redirectFor('/events/8750-judenburg/2026-10-17/dup-slug')).toBe(
      '/events/8750-judenburg/2026-10-17/primary-slug',
    );
  });

  it('Zyklus in duplicate_of: kein Ziel (404 statt Endlosschleife)', async () => {
    db.rows.push(
      ev({ id: PRIMARY_ID, slug: 'a-slug', publish_status: 'duplicate', duplicate_of: DUP_ID }),
      ev({ id: DUP_ID, slug: 'b-slug', publish_status: 'duplicate', duplicate_of: PRIMARY_ID }),
    );
    expect(await redirectFor('/events/8750-judenburg/2026-10-17/b-slug')).toBeNull();
  });

  it('Loop-Schutz: Ziel gleich angefragter URL ergibt kein Redirect', async () => {
    db.rows.push(ev({ id: PRIMARY_ID, slug: 'same' }));
    const dup = ev({ id: DUP_ID, slug: 'same', publish_status: 'duplicate', duplicate_of: PRIMARY_ID });
    expect(
      await resolveDuplicateRedirect(dup as unknown as Event, '/events/8750-judenburg/2026-10-17/same'),
    ).toBeNull();
  });

  it('unbekannter Slug bleibt 404', async () => {
    expect(await redirectFor('/events/8750-judenburg/2026-10-17/gibts-nicht')).toBe('no-event');
  });
});
