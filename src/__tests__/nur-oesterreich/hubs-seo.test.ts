// @vitest-environment node
/**
 * lasstreffen.at ist rein österreichisch: Startseite, Gemeinde- und
 * Themen-Hubs, Widget, Event-Sitemaps, Indexing-Meldungen, "Events in der
 * Nähe" auf Aktivitäten und die Blog-Boxen spielen nur Events mit
 * country = SITE_COUNTRY aus.
 *
 * Die Supabase-Attrappe schneidet jede Abfrage mit und wendet die
 * eq-Filter auf ihre Zeilen an. Ein Event aus Deutschland verschwindet
 * also nur, wenn der Code den Länderfilter wirklich setzt. Grenznahe
 * Fälle (Lindau im Umkreis von Bregenz) liegen dafür mitten im Radius.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SITE_COUNTRY } from '@/lib/site-country';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

type Row = Record<string, unknown>;
interface Call { method: string; args: unknown[] }
interface Chain { table: string; calls: Call[] }

const state = vi.hoisted(() => ({
  chains: [] as Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>,
  rowsFor: (() => []) as (chain: { table: string; calls: Array<{ method: string; args: unknown[] }> }) => Array<Record<string, unknown>>,
}));

vi.mock('@supabase/supabase-js', () => {
  const applyEq = (chain: Chain, rows: Row[]): Row[] =>
    rows.filter((row) =>
      chain.calls.every(({ method, args }) => {
        if (method !== 'eq') return true;
        const col = String(args[0]);
        return !(col in row) || row[col] === args[1];
      }),
    );
  const makeChain = (table: string): unknown => {
    const chain: Chain = { table, calls: [] };
    state.chains.push(chain);
    const builder: unknown = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const p = Promise.resolve({ data: applyEq(chain, state.rowsFor(chain)), error: null });
          return p.then.bind(p);
        }
        return (...args: unknown[]) => {
          chain.calls.push({ method: String(prop), args });
          return builder;
        };
      },
    });
    return builder;
  };
  return { createClient: () => ({ from: (t: string) => makeChain(t) }) };
});

// Durchreichen: geprüft werden die Abfragen, nicht das Next-Caching.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/lib/seo/experiments-server', () => ({
  resolveExperimentForScope: vi.fn(async () => null),
}));
vi.mock('@/lib/seo/hub-refresh', () => ({
  getHubIntro: vi.fn(async () => ({ intro: 'Intro.' })),
}));

// Indexing-Kanäle: nie echt senden, auch nicht versehentlich.
const submitToIndexNow = vi.fn();
vi.mock('@/lib/indexnow', () => ({
  submitToIndexNow: (...args: unknown[]) => submitToIndexNow(...args),
}));
vi.mock('@/lib/indexing-api', () => ({
  submitToGoogleIndexing: vi.fn(),
  isGoogleIndexingConfigured: () => false,
}));
// Das Indexing-Skript liest .env.local selbst ein; im Test soll es das nicht.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const readFileSync = ((p: unknown, ...rest: unknown[]) => {
    if (String(p).endsWith('.env.local')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return (actual.readFileSync as (...a: unknown[]) => unknown)(p, ...rest);
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});

const { ALL_GEMEINDEN } = await import('@/lib/gemeinden/data');

const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

function eventRow(id: string, country: string, over: Row = {}): Row {
  return {
    id,
    title: `Event ${id}`,
    slug: `event-${id}`,
    start_date: tomorrow,
    end_date: null,
    location_name: country === SITE_COUNTRY ? 'Festspielhaus' : 'Inselhalle Lindau',
    address: null,
    postal_code: country === SITE_COUNTRY ? '6900' : '88131',
    bundesland: country === SITE_COUNTRY ? 'Vorarlberg' : null,
    category: 'Musik',
    image_url: null,
    image_width: null,
    publish_status: 'published',
    visibility: 'public',
    event_score: 70,
    quality_score: 80,
    tags: [],
    source_name: 'Eventim',
    ticket_url: `https://www.eventim.at/${id}`,
    country,
    ...over,
  };
}

function eqArgs(chain: Chain): unknown[][] {
  return chain.calls.filter((c) => c.method === 'eq').map((c) => c.args);
}

function eventChains(): Chain[] {
  return state.chains.filter((c) => c.table === 'events');
}

/** Sammelt die Text-Knoten eines RSC-Baums (ohne Rendern). */
function texts(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) texts(child, out);
    return out;
  }
  if (typeof node === 'object') {
    const props = (node as { props?: Record<string, unknown> }).props;
    if (props) texts(props.children, out);
  }
  return out;
}

beforeEach(() => {
  state.chains.length = 0;
  state.rowsFor = () => [];
});

describe('Startseite: alle Sektionen nur AT', () => {
  it('Wochenende, Konzerte und Saison filtern auf das Land, DE-Events fallen raus', async () => {
    const { getLandingData } = await import('@/lib/v4/get-landing-data');
    // Simple Plan (DE) hatte den höchsten Score der Woche.
    state.rowsFor = (chain) => chain.table === 'events'
      ? [eventRow('at-1', 'AT'), eventRow('de-1', 'DE', { event_score: 99 })]
      : [];

    const data = await getLandingData();

    expect(data.todayWeekend.map((e) => e.id)).toEqual(['at-1']);
    expect(data.concerts.map((e) => e.id)).toEqual(['at-1']);
    // at-1 steht schon im Wochenende; ohne Länderfilter käme de-1 hier rein.
    expect(data.season.picks).toEqual([]);

    // weekendSharp, weekend, concertsSharp, concerts, season
    expect(eventChains()).toHaveLength(5);
    for (const chain of eventChains()) {
      expect(eqArgs(chain)).toContainEqual(['country', SITE_COUNTRY]);
    }
  });

  it('Admin-Pins und Festival-Elternevents nur aus dem Land der Seite', async () => {
    const { getLandingData } = await import('@/lib/v4/get-landing-data');
    await getLandingData();

    const featured = state.chains.find((c) => c.table === 'landing_features')!;
    expect(eqArgs(featured)).toContainEqual(['event.country', SITE_COUNTRY]);
    const festivals = state.chains.find((c) => c.table === 'festivals')!;
    expect(eqArgs(festivals)).toContainEqual(['parent_event.country', SITE_COUNTRY]);
  });
});

describe('Gemeinde-Hub: Umkreis über die Grenze zählt nicht', () => {
  it('Lindau-Events im Radius machen einen Hub weder voll noch indexierbar', async () => {
    const { generateMetadata } = await import('@/app/[locale]/gemeinde/[slug]/page');
    const g = ALL_GEMEINDEN[0];
    const at = (id: string) => eventRow(id, 'AT', { latitude: g.lat, longitude: g.lng });
    const de = (id: string) => eventRow(id, 'DE', { latitude: g.lat, longitude: g.lng });
    state.rowsFor = (chain) => chain.table === 'events'
      ? [at('at-1'), at('at-2'), de('de-1'), de('de-2'), de('de-3'), de('de-4')]
      : [];

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'de', slug: g.slug }) });

    // Zwei österreichische Events: unter der Schwelle von drei, also noindex.
    expect(metadata.robots).toEqual({ index: false, follow: true });
    const events = eventChains();
    expect(events).toHaveLength(1);
    expect(eqArgs(events[0])).toContainEqual(['country', SITE_COUNTRY]);
  });
});

describe('Themen-Hub: österreichweit heißt nur AT', () => {
  it('DE/CH-Termine füllen die Top-Liste nicht und zählen nicht fürs Indexieren', async () => {
    const { generateMetadata } = await import('@/app/[locale]/thema/[slug]/page');
    state.rowsFor = (chain) => {
      if (chain.table !== 'events') return [];
      // Nur die Top-Liste; die Bundesland-Zählungen laufen als head-Abfragen.
      if (!chain.calls.some((c) => c.method === 'order')) return [];
      return [eventRow('at-1', 'AT'), eventRow('at-2', 'AT'), eventRow('de-1', 'DE'), eventRow('ch-1', 'CH')];
    };

    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'de', slug: 'musik' }) });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    const top = eventChains().find((c) => c.calls.some((x) => x.method === 'limit'))!;
    expect(eqArgs(top)).toContainEqual(['country', SITE_COUNTRY]);
  });
});

describe('Widget: alle Scopes nur AT', () => {
  it.each([
    ['oesterreich', 'ganz Österreich ohne Ortsfilter'],
    [ALL_GEMEINDEN[0].slug, 'Gemeinde-Umkreis'],
  ])('%s (%s)', async (region) => {
    const { default: WidgetPage } = await import('@/app/[locale]/widget/[region]/page');
    const g = ALL_GEMEINDEN[0];
    state.rowsFor = () => [
      eventRow('at-1', 'AT', { latitude: g.lat, longitude: g.lng, title: 'Konzert Bregenz' }),
      eventRow('de-1', 'DE', { latitude: g.lat, longitude: g.lng, title: 'Konzert Lindau' }),
    ];

    const out = texts(await WidgetPage({ params: Promise.resolve({ region }) })).join(' ');

    expect(out).toContain('Konzert Bregenz');
    expect(out).not.toContain('Konzert Lindau');
    expect(eqArgs(eventChains()[0])).toContainEqual(['country', SITE_COUNTRY]);
  });
});

describe('Event-Sitemaps: nur AT, Shard-Fenster und Keyset unverändert', () => {
  it('DE-Events fehlen in DE- und /en-URLs; Seite 2 liest ab der letzten AT-id weiter', async () => {
    const { buildEventsShardResponse } = await import('@/lib/seo/sitemap-events-shard');
    const id = (n: number) => `0${n.toString(16).padStart(7, '0')}-0000-4000-8000-000000000000`;
    const page1 = Array.from({ length: 1000 }, (_, i) => eventRow(id(i), 'AT', { title_en: 'EN' }));
    const page2 = [eventRow(id(1000), 'AT', { title_en: 'EN' })];
    const foreign = [eventRow(id(5000), 'DE', { slug: 'simple-plan-mitsubishi-electric-halle', title_en: 'EN' })];
    state.rowsFor = (chain) => {
      const keyset = chain.calls.some((c) => c.method === 'gt' && c.args[0] === 'id');
      return keyset ? [...page2, ...foreign] : [...page1, ...foreign];
    };

    const res = await buildEventsShardResponse(0);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain('simple-plan-mitsubishi-electric-halle');
    expect(body).toContain(`/en/events/`);
    // 1001 AT-Events, je DE- und /en-URL
    expect(body.match(/<loc>/g)).toHaveLength(2002);

    const [first, second] = eventChains();
    expect(eventChains()).toHaveLength(2);
    for (const chain of [first, second]) {
      expect(eqArgs(chain)).toContainEqual(['country', SITE_COUNTRY]);
      expect(chain.calls).toContainEqual({ method: 'gte', args: ['id', '00000000-0000-0000-0000-000000000000'] });
      expect(chain.calls).toContainEqual({ method: 'lt', args: ['id', '20000000-0000-0000-0000-000000000000'] });
      expect(chain.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
      expect(chain.calls).toContainEqual({ method: 'limit', args: [1000] });
    }
    expect(first.calls.some((c) => c.method === 'gt')).toBe(false);
    expect(second.calls).toContainEqual({ method: 'gt', args: ['id', id(999)] });
  });
});

describe('Aktivität: "Events in der Nähe" nur AT', () => {
  it('Erstabfrage und Backfill filtern auf das Land', async () => {
    const { loadNearbyFutureEventsCached } = await import('@/lib/activities/nearby-loaders');
    const LAT = 47.5;
    const LNG = 9.75;
    // Pool voll mit Ecken-Events (außerhalb des Kreises) erzwingt den Backfill.
    const corner = Array.from({ length: 60 }, (_, i) =>
      eventRow(`corner-${i}`, 'AT', { latitude: LAT + 0.088, longitude: LNG + 0.132 }));
    let n = 0;
    state.rowsFor = (chain) => {
      if (chain.table !== 'events') return [];
      n += 1;
      const lindau = eventRow('de-1', 'DE', { latitude: LAT + 0.01, longitude: LNG + 0.01 });
      return n === 1
        ? [...corner, lindau]
        : [eventRow('at-1', 'AT', { latitude: LAT + 0.01, longitude: LNG + 0.01 }), lindau];
    };

    const result = await loadNearbyFutureEventsCached(LAT, LNG, 10);

    expect(result.map((e) => e.id)).toEqual(['at-1']);
    expect(eventChains()).toHaveLength(2);
    for (const chain of eventChains()) {
      expect(eqArgs(chain)).toContainEqual(['country', SITE_COUNTRY]);
    }
  });
});

describe('Blog: Ticket-Box und passende Events nur AT', () => {
  it('Ticket-Box zeigt keine Eventim-Termine aus Deutschland', async () => {
    const { BlogTicketBox } = await import('@/components/Blog/BlogTicketBox');
    state.rowsFor = () => [
      eventRow('at-1', 'AT', { title: 'Harry Potter Konzert Wien' }),
      eventRow('de-1', 'DE', { title: 'Harry Potter Konzert Gießen' }),
    ];

    const out = texts(await BlogTicketBox({ postTitle: 'Die Musik von Harry Potter 2026' })).join(' ');

    expect(out).toContain('Harry Potter Konzert Wien');
    expect(out).not.toContain('Gießen');
    expect(eqArgs(eventChains()[0])).toContainEqual(['country', SITE_COUNTRY]);
  });

  it('passende Events: alle drei Stufen (Begriffe, Rubrik, Tickets) filtern auf das Land', async () => {
    const { RelatedEvents } = await import('@/components/Blog/RelatedEvents');
    state.rowsFor = () => [
      eventRow('at-1', 'AT', { title: 'Brettl-Spitzen Linz' }),
      eventRow('de-1', 'DE', { title: 'Brettl-Spitzen Bad Griesbach' }),
    ];

    const out = texts(await RelatedEvents({ postTitle: 'Brettl-Spitzen 2026', category: 'Musik' })).join(' ');

    expect(out).toContain('Brettl-Spitzen Linz');
    expect(out).not.toContain('Bad Griesbach');
    expect(eventChains()).toHaveLength(3);
    for (const chain of eventChains()) {
      expect(eqArgs(chain)).toContainEqual(['country', SITE_COUNTRY]);
    }
  });
});

describe('Indexing-Meldungen: nur AT an Google und IndexNow', () => {
  it('Kandidaten-Abfrage filtert auf das Land', async () => {
    const argv = process.argv;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    state.rowsFor = () => [eventRow('at-1', 'AT'), eventRow('de-1', 'DE')];
    process.argv = [argv[0], 'submit-to-indexing.ts', '--dry-run', '--indexnow-only'];
    try {
      await import('@/scripts/submit-to-indexing');
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith('\nDone.'));
    } finally {
      process.argv = argv;
    }

    expect(log).toHaveBeenCalledWith('  Candidates:  1');
    expect(eqArgs(eventChains()[0])).toContainEqual(['country', SITE_COUNTRY]);
    expect(submitToIndexNow).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    log.mockRestore();
    exit.mockRestore();
  });
});
