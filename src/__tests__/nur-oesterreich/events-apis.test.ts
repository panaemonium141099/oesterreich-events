/**
 * lasstreffen.at ist rein österreichisch: die öffentlichen Event-APIs
 * dürfen kein Event mit country <> 'AT' ausliefern, egal über welchen Weg
 * (Liste, Karte, Suche, Kurz-ID, OG-Bild, Boost-Kauf, Erinnerung).
 *
 * Statt nur Aufrufe zu zählen, läuft jede Route gegen eine kleine
 * In-Memory-Tabelle, die eq/in/gte/lte/not/ilike/or wirklich auswertet. Die
 * Testdaten bilden die Prod-Befunde nach: ein DE-Event im österreichischen
 * Rechteck (Rosenheim), ein CH-Event mit österreichischem Bezirk, ein
 * CH-Event ohne Koordinaten und ein DE-Event, das den 8-stelligen
 * Kurz-ID-Präfix mit einem österreichischen teilt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SITE_COUNTRY } from '@/lib/site-country';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  upserts: [] as { table: string; row: unknown }[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  ogElements: [] as unknown[],
  stripeCreate: null as null | ((args: unknown) => Promise<{ url: string }>),
}));

/** Minimaler PostgREST-Builder über state.tables. `order` ist bewusst
 *  wirkungslos: die Tabellenreihenfolge steht für die Index-Reihenfolge.
 *  `or` wertet einfache Listen aus eq, ilike und is.null aus (Chat-Suche,
 *  Related, Unmapped). Klammern (and(...), in.(...)) oder andere Operatoren
 *  lassen den Aufruf wirkungslos, statt still falsch zu filtern. */
function makeBuilder(table: string) {
  let rows: Row[] = [...(state.tables[table] ?? [])];
  let head = false;
  let limitN: number | null = null;
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const final = (): Row[] => {
    let out = rows;
    if (rangeFrom !== null && rangeTo !== null) out = out.slice(rangeFrom, rangeTo + 1);
    if (limitN !== null) out = out.slice(0, limitN);
    return out;
  };

  const ilikeToRegex = (pattern: string) =>
    new RegExp(
      '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$',
      'i',
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: (_cols?: string, opts?: { head?: boolean }) => {
      head = !!opts?.head;
      return b;
    },
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return b;
    },
    neq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] !== val);
      return b;
    },
    gte: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] != null && (typeof val === 'number'
        ? Number(r[col]) >= val
        : String(r[col]) >= String(val)));
      return b;
    },
    lte: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] != null && (typeof val === 'number'
        ? Number(r[col]) <= val
        : String(r[col]) <= String(val)));
      return b;
    },
    in: (col: string, vals: unknown[]) => {
      rows = rows.filter((r) => vals.includes(r[col]));
      return b;
    },
    not: (col: string, op: string, val: unknown) => {
      if (op === 'is' && val === null) rows = rows.filter((r) => r[col] != null);
      return b;
    },
    ilike: (col: string, pattern: string) => {
      const re = ilikeToRegex(pattern);
      rows = rows.filter((r) => typeof r[col] === 'string' && re.test(r[col] as string));
      return b;
    },
    or: (clause: string) => {
      if (clause.includes('(')) return b;
      const tests: ((r: Row) => boolean)[] = [];
      for (const part of clause.split(',')) {
        const m = part.match(/^([a-z_]+)\.(eq|ilike|is)\.(.*)$/);
        if (!m) return b;
        const [, col, op, val] = m;
        if (op === 'eq') tests.push((r) => r[col] != null && String(r[col]) === val);
        else if (op === 'ilike') {
          const re = ilikeToRegex(val);
          tests.push((r) => typeof r[col] === 'string' && re.test(r[col] as string));
        } else if (val === 'null') tests.push((r) => r[col] == null);
        else return b;
      }
      rows = rows.filter((r) => tests.some((t) => t(r)));
      return b;
    },
    overlaps: () => b,
    order: () => b,
    limit: (n: number) => {
      limitN = n;
      return b;
    },
    range: (from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return b;
    },
    single: async () => {
      const out = final();
      return out.length === 1
        ? { data: out[0], error: null }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
    },
    maybeSingle: async () => {
      const out = final();
      return out.length <= 1
        ? { data: out[0] ?? null, error: null }
        : { data: null, error: { message: 'multiple rows' } };
    },
    upsert: async (row: unknown) => {
      state.upserts.push({ table, row });
      return { error: null };
    },
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({
        data: head ? null : final(),
        error: null,
        count: rows.length,
      }).then(onFulfilled, onRejected),
  };
  return b;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => makeBuilder(table),
    // search_event_ids wie in Prod: countries=NULL heißt alle Länder.
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (fn !== 'search_event_ids') return { data: null, error: { message: 'unknown rpc' } };
      const q = String(args.q).toLowerCase();
      const countries = args.countries as string[] | null | undefined;
      const hits = (state.tables.events ?? []).filter((r) =>
        String(r.title).toLowerCase().includes(q) &&
        (countries == null || countries.includes(r.country as string)),
      );
      return { data: hits.map((r) => ({ id: r.id })), error: null };
    }),
  })),
}));

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(element: unknown) {
      state.ogElements.push(element);
    }
  },
}));

vi.mock('@/lib/payments/stripe-boost', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/payments/stripe-boost')>();
  return {
    ...orig,
    getStripe: () => ({
      checkout: { sessions: { create: (args: unknown) => state.stripeCreate!(args) } },
    }),
  };
});

vi.mock('@/lib/email', () => ({
  sendGenericEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/event-reminder', () => ({
  isPlausibleEmail: () => true,
  reminderToken: vi.fn(async () => 'tok'),
  reminderConfirmMailHtml: () => '<p>bitte bestätigen</p>',
}));

const FUTURE = '2099-06-01T16:00:00Z';

const base = {
  visibility: 'public',
  publish_status: 'published',
  start_date: FUTURE,
  end_date: null,
  category: 'Musik',
  quality_score: 80,
  event_score: 70,
  venue_id: null,
  address: null,
  location_name: null,
  is_boosted: false,
  boost_until: null,
};

// DE-Event, dessen 8-stelliger Präfix mit AT_EISENSTADT übereinstimmt
// (Prod: dd84e4d5). Steht vorne, wie im PK-Index (kleinere id).
const DE_PREFIX_TWIN: Row = {
  ...base, id: 'aaaaaaaa-0000-4000-8000-000000000000', country: 'DE',
  title: 'Olympiahalle München', bundesland: null, district: null,
  latitude: 48.17, longitude: 11.55, slug: 'olympiahalle-muenchen',
};
// DE-Event mit gleichem Slug wie das AT-Event, früher im Kalender.
const DE_SLUG_TWIN: Row = {
  ...base, id: 'eeeeeeee-5555-4555-8555-555555555555', country: 'DE',
  title: 'Kirtag (Passau)', bundesland: null, district: null,
  latitude: 48.57, longitude: 13.43, slug: 'kirtag-eisenstadt',
  start_date: '2099-05-01T16:00:00Z',
};
const AT_EISENSTADT: Row = {
  ...base, id: 'aaaaaaaa-1111-4111-8111-111111111111', country: 'AT',
  title: 'Kirtag Eisenstadt', bundesland: 'burgenland', district: 'eisenstadt',
  latitude: 47.84, longitude: 16.52, slug: 'kirtag-eisenstadt',
};
// Prod: DE-Event im österreichischen Rechteck (Ballhaus Rosenheim).
const DE_ROSENHEIM: Row = {
  ...base, id: 'dddddddd-2222-4222-8222-222222222222', country: 'DE',
  title: 'Vince Ebert Rosenheim', bundesland: null, district: null,
  latitude: 47.85, longitude: 12.12, slug: 'vince-ebert-rosenheim',
};
// Prod: CH-Event mit österreichischem Bezirk (Gasthaus Albisgütli).
const CH_MIT_AT_BEZIRK: Row = {
  ...base, id: 'cccccccc-4444-4444-8444-444444444444', country: 'CH',
  title: 'Gasthaus Albisgütli', bundesland: null, district: 'graz-umgebung',
  latitude: 47.36, longitude: 8.51, slug: 'gasthaus-albisguetli',
};
// Ohne Koordinaten (includeUnmapped-Pfad).
const CH_OHNE_KOORDINATEN: Row = {
  ...base, id: 'cccccccc-6666-4666-8666-666666666666', country: 'CH',
  title: 'St. Jakobshalle Basel', bundesland: null, district: 'linz-land',
  latitude: null, longitude: null, slug: 'st-jakobshalle-basel',
};
const AT_OHNE_KOORDINATEN: Row = {
  ...base, id: 'bbbbbbbb-7777-4777-8777-777777777777', country: 'AT',
  title: 'Konzert Linz', bundesland: 'oberoesterreich', district: 'linz-land',
  latitude: null, longitude: null, slug: 'konzert-linz',
};

const ALL_EVENTS = [
  DE_PREFIX_TWIN, DE_SLUG_TWIN, AT_EISENSTADT, DE_ROSENHEIM,
  CH_MIT_AT_BEZIRK, CH_OHNE_KOORDINATEN, AT_OHNE_KOORDINATEN,
];

const { GET: listEvents } = await import('@/app/api/events/route');
const { GET: getEventById } = await import('@/app/api/events/[id]/route');
const { GET: relatedEvents } = await import('@/app/api/events/related/route');
const { GET: searchEvents } = await import('@/app/api/events/search/route');
const { GET: ogImage } = await import('@/app/api/og/event/[shortId]/route');
const { POST: boostCheckout } = await import('@/app/api/checkout/boost/route');
const { POST: subscribeReminder } = await import('@/app/api/event-reminder/subscribe/route');

function get(path: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function countriesOf(events: Row[]): string[] {
  const byId = new Map(ALL_EVENTS.map((e) => [e.id, e.country as string]));
  return events.map((e) => byId.get(e.id) ?? 'unbekannt');
}

/** Alle Texte eines React-Elementbaums (für das OG-Bild). */
function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  const props = (node as { props?: { children?: unknown } }).props;
  return props ? textOf(props.children) : '';
}

beforeEach(() => {
  state.tables = { events: ALL_EVENTS.map((e) => ({ ...e })), venues: [] };
  state.upserts = [];
  state.rpcCalls = [];
  state.ogElements = [];
  state.stripeCreate = vi.fn(async () => ({ url: 'https://checkout.stripe.test/s' }));
});

describe('SITE_COUNTRY', () => {
  it('ist Österreich', () => {
    expect(SITE_COUNTRY).toBe('AT');
  });
});

describe('GET /api/events: nur Österreich, ohne countries-Schalter', () => {
  it('liefert ohne Parameter nur österreichische Events', async () => {
    const res = await listEvents(get('/api/events'));
    const json = await res.json();
    expect(json.events.length).toBeGreaterThan(0);
    expect(countriesOf(json.events)).toEqual(json.events.map(() => SITE_COUNTRY));
  });

  it.each(['DE', 'CH', 'AT,DE,CH', 'de'])('ignoriert countries=%s', async (countries) => {
    const res = await listEvents(get('/api/events', { countries }));
    const json = await res.json();
    expect(json.events.map((e: Row) => e.id)).toEqual([AT_EISENSTADT.id]);
  });

  it('bbox um Rosenheim im österreichischen Rechteck liefert kein DE-Event', async () => {
    const res = await listEvents(get('/api/events', {
      bbox: '47.7,11.9,48.0,12.3',
      countries: 'AT,DE,CH',
    }));
    const json = await res.json();
    expect(json.events).toEqual([]);
  });

  it('österreichischer Bezirk liefert kein CH-Event mit diesem Bezirk', async () => {
    const res = await listEvents(get('/api/events', {
      districts: 'graz-umgebung',
      countries: 'AT,DE,CH',
    }));
    const json = await res.json();
    expect(json.events).toEqual([]);
  });

  it('countOnly zählt nur österreichische Events', async () => {
    const res = await listEvents(get('/api/events', { countOnly: 'true', countries: 'AT,DE,CH' }));
    const json = await res.json();
    expect(json.total).toBe(1);
  });

  it('Suche fragt search_event_ids immer mit countries=[SITE_COUNTRY]', async () => {
    const res = await listEvents(get('/api/events', { search: 'rosenheim', countries: 'AT,DE,CH' }));
    const json = await res.json();
    expect(state.rpcCalls).toEqual([
      expect.objectContaining({
        fn: 'search_event_ids',
        args: expect.objectContaining({ countries: [SITE_COUNTRY] }),
      }),
    ]);
    expect(json.events).toEqual([]);
  });

  it('includeUnmapped liefert keine DE/CH-Events ohne Koordinaten', async () => {
    const res = await listEvents(get('/api/events', { includeUnmapped: 'true', countries: 'AT,DE,CH' }));
    const json = await res.json();
    expect(json.unmappedEvents.length).toBeGreaterThan(0);
    expect(json.unmappedEvents.map((e: Row) => e.id)).toContain(AT_OHNE_KOORDINATEN.id);
    expect(countriesOf(json.unmappedEvents)).toEqual(json.unmappedEvents.map(() => SITE_COUNTRY));
  });
});

describe('GET /api/events/[id]: ausländische Events 404', () => {
  const call = (id: string) => getEventById(get(`/api/events/${id}`), { params: Promise.resolve({ id }) });

  it('volle UUID eines DE-Events: 404', async () => {
    const res = await call(DE_ROSENHEIM.id as string);
    expect(res.status).toBe(404);
  });

  it('12-Hex-Kurz-ID eines CH-Events: 404', async () => {
    const shortId = (CH_MIT_AT_BEZIRK.id as string).replace(/-/g, '').slice(0, 12);
    const res = await call(shortId);
    expect(res.status).toBe(404);
  });

  it('österreichisches Event per UUID und Kurz-ID: 200', async () => {
    const full = await call(AT_EISENSTADT.id as string);
    expect(full.status).toBe(200);
    expect((await full.json()).id).toBe(AT_EISENSTADT.id);

    const shortId = (AT_EISENSTADT.id as string).replace(/-/g, '').slice(0, 12);
    const short = await call(shortId);
    expect(short.status).toBe(200);
    expect((await short.json()).id).toBe(AT_EISENSTADT.id);
  });
});

describe('GET /api/events/search (Chat-Suche)', () => {
  it('Treffer in AT und DE: nur das österreichische Event kommt zurück', async () => {
    // "Kirtag" trifft AT_EISENSTADT und DE_SLUG_TWIN ("Kirtag (Passau)").
    const res = await searchEvents(get('/api/events/search', { q: 'Kirtag' }));
    const json = await res.json();
    expect(json.events.map((e: Row) => e.id)).toEqual([AT_EISENSTADT.id]);
  });

  it('Suchbegriff nur in einem DE-Event: leere Liste', async () => {
    const res = await searchEvents(get('/api/events/search', { q: 'Rosenheim' }));
    const json = await res.json();
    expect(json.events).toEqual([]);
  });
});

describe('GET /api/events/related', () => {
  it('Kandidaten gleicher Kategorie sind nur österreichisch', async () => {
    const res = await relatedEvents(get('/api/events/related', {
      eventId: AT_OHNE_KOORDINATEN.id as string,
      limit: '8',
    }));
    const json = await res.json();
    expect(json.events.map((e: Row) => e.id)).toEqual([AT_EISENSTADT.id]);
  });
});

describe('GET /api/og/event/[shortId]', () => {
  const render = async (shortId: string) => {
    await ogImage(new Request(`http://localhost:3000/api/og/event/${shortId}`), {
      params: Promise.resolve({ shortId }),
    });
    return textOf(state.ogElements.at(-1));
  };

  it('DE-Event bekommt das generische Bild ohne Titel', async () => {
    const text = await render((DE_ROSENHEIM.id as string).slice(0, 8));
    expect(text).toContain('Event in Österreich');
    expect(text).not.toContain(DE_ROSENHEIM.title as string);
  });

  it('volle UUID eines CH-Events: generisches Bild', async () => {
    const text = await render(CH_MIT_AT_BEZIRK.id as string);
    expect(text).toContain('Event in Österreich');
    expect(text).not.toContain(CH_MIT_AT_BEZIRK.title as string);
  });

  it('gemeinsamer 8-stelliger Präfix: das österreichische Event gewinnt', async () => {
    const text = await render('aaaaaaaa');
    expect(text).toContain(AT_EISENSTADT.title as string);
    expect(text).not.toContain(DE_PREFIX_TWIN.title as string);
  });
});

describe('POST /api/checkout/boost', () => {
  it('DE-Event ist nicht boostbar (404, keine Stripe-Session)', async () => {
    const res = await boostCheckout(post('/api/checkout/boost', { eventRef: DE_ROSENHEIM.id }));
    expect(res.status).toBe(404);
    expect(state.stripeCreate).not.toHaveBeenCalled();
  });

  it('gleicher Slug: die österreichische Zeile wird gekauft, nicht die DE-Zeile', async () => {
    const res = await boostCheckout(post('/api/checkout/boost', {
      eventRef: 'https://lasstreffen.at/events/7000-eisenstadt/kirtag-eisenstadt',
    }));
    expect(res.status).toBe(200);
    expect(state.stripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { event_id: AT_EISENSTADT.id } }),
    );
  });
});

describe('POST /api/event-reminder/subscribe', () => {
  it('Erinnerung an ein DE-Event: 404, nichts gespeichert', async () => {
    const res = await subscribeReminder(post('/api/event-reminder/subscribe', {
      email: 'test@example.org',
      eventId: DE_ROSENHEIM.id,
    }));
    expect(res.status).toBe(404);
    expect(state.upserts).toEqual([]);
  });

  it('Erinnerung an ein österreichisches Event wird angelegt', async () => {
    const res = await subscribeReminder(post('/api/event-reminder/subscribe', {
      email: 'test@example.org',
      eventId: AT_EISENSTADT.id,
    }));
    expect(res.status).toBe(200);
    expect(state.upserts).toEqual([
      expect.objectContaining({
        table: 'event_email_reminders',
        row: expect.objectContaining({ event_id: AT_EISENSTADT.id }),
      }),
    ]);
  });
});
