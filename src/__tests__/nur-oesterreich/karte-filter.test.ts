// @vitest-environment node
//
// lasstreffen.at ist rein österreichisch (src/lib/site-country.ts). Diese
// Datei sichert die Karten- und Filterseite ab: kein Schalter mehr für
// Deutschland und die Schweiz, keine Pseudo-Region 'at-de-ch' als Karte,
// Hub, Sitemap-Eintrag oder Link, und keine alten DE/CH-Listen aus dem
// sessionStorage-Cache. Läuft ohne DOM, weil die Sitemap-Route den
// kompletten Gemeinde-Datensatz baut (siehe sitemap-split.test.ts).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SITE_COUNTRY } from '@/lib/site-country';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { isValidBundesland } from '@/lib/landing-slugs';
import { BUNDESLAND_IDS } from '@/lib/search/smart-query';
import { BUNDESLAND_HUB_LINKS } from '@/lib/hubs/hub-directory';
import { buildEventParams } from '@/lib/v4/use-filtered-events';
import { pointsEligible } from '@/lib/v4/map-points';
import { readCache, writeCache } from '@/components/MapV3/eventsCache';
import type { Event, EventFilters } from '@/types/events';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Abfrage-Kette der Sitemap-Route: jeder Aufruf wird protokolliert.
const calls: Array<[string, unknown[]]> = [];
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not', 'is', 'order', 'limit']) {
    q[m] = (...args: unknown[]) => { calls.push([m, args]); return q; };
  }
  q.then = (ok?: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, fail);
  return q;
}
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mockFrom })) }));

// next.config.ts ohne die Build-Plugins laden, nur die Redirects zählen.
vi.mock('@next/bundle-analyzer', () => ({ default: () => (c: unknown) => c }));
vi.mock('next-intl/plugin', () => ({ default: () => (c: unknown) => c }));

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf-8');

describe('Bundesländer: nur die 9 echten, keine Pseudo-Region', () => {
  const real = BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => b.id);

  it('BUNDESLAENDER kennt neben dem Karten-Scope all genau die 9 Bundesländer', () => {
    expect(BUNDESLAENDER.find((b) => b.id === 'at-de-ch')).toBeUndefined();
    expect([...real].sort()).toEqual([...BUNDESLAND_IDS].sort());
    for (const b of BUNDESLAENDER) {
      expect(b.geojsonFile).not.toContain('at-de-ch');
      expect(b.name).not.toMatch(/Deutschland|Schweiz/);
    }
  });

  it('Hub-Seiten gelten nur für echte Bundesländer', () => {
    for (const id of BUNDESLAND_IDS) expect(isValidBundesland(id)).toBe(true);
    expect(isValidBundesland('all')).toBe(false);
    expect(isValidBundesland('at-de-ch')).toBe(false);
  });

  it('die Region-Rail verlinkt genau die 9 Bundesland-Hubs', () => {
    expect(BUNDESLAND_HUB_LINKS.map((l) => l.href).sort()).toEqual(BUNDESLAND_IDS.map((id) => `/${id}`).sort());
  });

  it('die Kartenmaske AT+DE+CH ist gelöscht', () => {
    expect(() => read('public/at-de-ch.geojson')).toThrow();
  });
});

describe('Karte und Liste fragen nie nach anderen Ländern', () => {
  // Ein alter Filterstand (URL, Cache, offener Tab) kann das frühere Feld
  // noch tragen; es darf nichts mehr bewirken.
  const stale = { atOnly: false } as unknown as EventFilters;

  it('buildEventParams sendet keinen countries-Parameter', () => {
    expect(buildEventParams({}, ['all']).get('countries')).toBeNull();
    expect(buildEventParams(stale, ['all']).get('countries')).toBeNull();
    expect(buildEventParams({ ...stale, tags: ['kirtag'] }, ['wien', 'tirol']).get('countries')).toBeNull();
  });

  it('der Punkte-Snapshot (nur AT) bleibt auch mit altem Filterstand zuständig', () => {
    expect(pointsEligible({})).toBe(true);
    expect(pointsEligible(stale)).toBe(true);
  });

  it('Kartenseite, Filterfenster und Hook kennen keinen Länder-Schalter mehr', () => {
    for (const f of [
      'src/app/[locale]/map/page.tsx',
      'src/components/MapV3/FilterDrawer.tsx',
      'src/lib/v4/use-filtered-events.ts',
      'src/lib/v4/map-points.ts',
      'src/types/events.ts',
    ]) {
      const src = read(f);
      expect(src, f).not.toMatch(/atOnly|includeDeCh|at-de-ch|AT,DE,CH/);
    }
  });

  it('die Texte des Schalters sind aus beiden Sprachen entfernt', () => {
    for (const f of ['messages/de.json', 'messages/en.json']) {
      const m = JSON.parse(read(f)) as { MapPage: Record<string, string> };
      expect(m.MapPage.atOnly, f).toBeUndefined();
      expect(m.MapPage.atOnlyTitle, f).toBeUndefined();
      expect(m.MapPage.includeDeCh, f).toBeUndefined();
    }
  });
});

describe('sessionStorage-Cache: alte Listen mit DE/CH verfallen', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    const sessionStorage = {
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    };
    vi.stubGlobal('window', { sessionStorage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ein Eintrag der Version v6 (Zeit des Schalters) wird nicht mehr gelesen', () => {
    const ev = { id: 'x', title: 'Konzert in München', start_date: '2026-10-10T18:00:00Z' } as Event;
    writeCache({}, [ev], 1);
    const [key] = [...store.keys()];
    expect(key).toMatch(/^mv3-events-cache-v\d+::/);
    expect(key.startsWith('mv3-events-cache-v6::')).toBe(false);
    expect(readCache({})?.events).toHaveLength(1);

    const legacy = key.replace(/^mv3-events-cache-v\d+::/, 'mv3-events-cache-v6::');
    store.clear();
    store.set(legacy, JSON.stringify({ ts: Date.now(), events: [ev], total: 1 }));
    expect(readCache({})).toBeNull();
  });
});

describe('sitemap-core.xml: Bundesland-Hubs und Venues nur Österreich', () => {
  beforeEach(() => {
    calls.length = 0;
    mockFrom.mockReset();
  });

  it('listet keine at-de-ch-URLs, aber alle 9 Bundesland-Hubs zweisprachig', async () => {
    mockFrom.mockReturnValue(chain({ data: [{ venue_id: 'venue-1' }], error: null }));
    const { GET } = await import('@/app/sitemap-core.xml/route');
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain('at-de-ch');
    for (const id of BUNDESLAND_IDS) {
      expect(body).toContain(`<loc>https://lasstreffen.at/${id}</loc>`);
      expect(body).toContain(`<loc>https://lasstreffen.at/en/${id}</loc>`);
    }
    expect(body).not.toContain('<loc>https://lasstreffen.at/all</loc>');
  }, 60_000);

  it('Venue-Seiten nur für Venues mit österreichischen Events', async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const { GET } = await import('@/app/sitemap-core.xml/route');
    await GET();

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(calls).toContainEqual(['eq', ['country', SITE_COUNTRY]]);
  }, 60_000);
});

describe('next.config: 301 für die alten at-de-ch-Hubs', () => {
  it('leitet /at-de-ch und /en/at-de-ch samt Unterpfaden auf die Startseite', async () => {
    const config = (await import('../../../next.config')).default as {
      redirects: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>;
    };
    const rules = await config.redirects();
    const find = (source: string) => rules.find((r) => r.source === source);

    expect(find('/at-de-ch')).toMatchObject({ destination: '/', permanent: true });
    expect(find('/at-de-ch/:path*')).toMatchObject({ destination: '/', permanent: true });
    expect(find('/en/at-de-ch')).toMatchObject({ destination: '/en', permanent: true });
    expect(find('/en/at-de-ch/:path*')).toMatchObject({ destination: '/en', permanent: true });
  });
});
