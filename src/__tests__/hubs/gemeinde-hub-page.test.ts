/**
 * fn-18 Task 4 — Gemeinde-Hub-Seite (Integration mit gemockter DB).
 *
 * Prueft die VERKABELUNG der Mixed-Content-Helper in page.tsx:
 *   - Indexierungs-Gate in generateMetadata: <3 Events aber >=3
 *     Aktivitaeten -> KEIN noindex; beide <3 -> noindex (beide Zweige).
 *   - Experiment-Override greift NUR bei event-only-Copy (Aktivitaeten < 3).
 *   - Page + generateMetadata mit identischen Args -> genau EIN
 *     DB-Roundtrip pro Tabelle (Memo-Mock fuer unstable_cache simuliert
 *     das Next-Cache-Verhalten; ein Arg-Drift wuerde doppelt queryen).
 *   - Fall (b) rendert Aktivitaets-Hero statt "keine Events"-Empty-State,
 *     und das JSON-LD im HTML enthaelt keine Event-ItemList.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// unstable_cache-Memo-Mock: cached pro (keyParts, args) wie Next selbst —
// nur wenn Page UND generateMetadata identische Args uebergeben, bleibt
// es bei EINEM Query (genau das ist der Vertrag, den wir testen).
vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => Promise<unknown>,
    keyParts?: string[],
  ) => {
    const cache = new Map<string, Promise<unknown>>();
    return (...args: unknown[]) => {
      const key = JSON.stringify([keyParts ?? [], args]);
      if (!cache.has(key)) cache.set(key, fn(...args));
      return cache.get(key)!;
    };
  },
}));

const fromCounts: Record<string, number> = {};
let dbRows: { events: unknown[]; activities: unknown[] } = { events: [], activities: [] };

function createChainableQuery(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'or', 'not', 'is', 'contains',
    'order', 'limit', 'range', 'filter', 'match',
  ];
  for (const method of chainMethods) {
    builder[method] = () => builder;
  }
  builder.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      fromCounts[table] = (fromCounts[table] ?? 0) + 1;
      const data = table === 'events' ? dbRows.events : dbRows.activities;
      return createChainableQuery({ data, error: null });
    },
  })),
}));

const resolveExperimentForScope = vi.fn();
vi.mock('@/lib/seo/experiments-server', () => ({
  resolveExperimentForScope: (...args: unknown[]) => resolveExperimentForScope(...args),
}));

vi.mock('@/lib/seo/hub-refresh', () => ({
  getHubIntro: vi.fn(async () => ({ intro: 'Rotierender Intro-Absatz.' })),
}));

const { ALL_GEMEINDEN } = await import('@/lib/gemeinden/data');
const { getCityHub } = await import('@/lib/hubs/city-hubs');
const pageModule = await import('@/app/[locale]/gemeinde/[slug]/page');
const { generateMetadata } = pageModule;
const GemeindeHubPage = pageModule.default;

// Nicht-City-Gemeinden — jede Testgruppe bekommt eine EIGENE (der Memo-
// Mock cached pro Koordinaten-Args ueber Testgrenzen hinweg).
const nonCity = ALL_GEMEINDEN.filter((g) => !getCityHub(g.slug));

function makeEventRows(g: { lat: number; lng: number }, n: number): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Event ${i}`,
    slug: `event-${i}`,
    start_date: '2027-06-01T19:00:00+00:00',
    end_date: null,
    location_name: 'Halle',
    address: null,
    postal_code: '7100',
    bundesland: 'burgenland',
    latitude: g.lat,
    longitude: g.lng,
    category: 'Musik',
    image_url: null,
    price_text: null,
    event_score: 50,
  }));
}

function makeActivityRows(g: { lat: number; lng: number }, n: number): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`,
    slug: `aktivitaet-${i}-abcdef123456`,
    name: `Aktivität ${i}`,
    tags: ['schwimmen'],
    town: 'Testdorf',
    lat: g.lat,
    lng: g.lng,
    price_hint: null,
    images: null,
  }));
}

/** JSX-Walker: sammelt Text-Knoten + JSON-LD-Scripts aus dem RSC-Baum. */
function collect(node: unknown, out: { texts: string[]; scripts: string[] }): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    out.texts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return;
  }
  if (typeof node === 'object') {
    const el = node as { type?: unknown; props?: Record<string, unknown> };
    if (!el.props) return;
    const dsih = el.props.dangerouslySetInnerHTML as { __html?: string } | undefined;
    if (el.type === 'script' && dsih?.__html) out.scripts.push(dsih.__html);
    collect(el.props.children, out);
  }
}

function metaTitle(metadata: { title?: unknown }): string {
  return (metadata.title as { absolute: string }).absolute;
}

describe('Gemeinde-Hub: Gate + Mixed-Copy + Query-Dedup', () => {
  beforeEach(() => {
    resolveExperimentForScope.mockReset();
    resolveExperimentForScope.mockResolvedValue(null);
    for (const key of Object.keys(fromCounts)) delete fromCounts[key];
  });

  it('Fall (b): <3 Events, >=3 Aktivitaeten -> KEIN noindex, Aktivitaets-Title, kein Experiment-Call', async () => {
    const g = nonCity[0];
    dbRows = { events: [], activities: makeActivityRows(g, 4) };

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: g.slug }) });

    expect(metadata.robots).toBeUndefined();
    expect(metaTitle(metadata)).toContain('Freizeitaktivitäten & Ausflugsziele in');
    expect(metadata.description).toContain('4 Freizeitaktivitäten');
    expect(resolveExperimentForScope).not.toHaveBeenCalled();
  });

  it('Fall (d): beide <3 -> noindex bleibt (heutiges Verhalten)', async () => {
    const g = nonCity[1];
    dbRows = { events: makeEventRows(g, 2), activities: makeActivityRows(g, 2) };

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: g.slug }) });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metaTitle(metadata)).toContain('Events in');
  });

  it('Fall (a): event-only -> Experiment-Override greift wie bisher', async () => {
    const g = nonCity[2];
    dbRows = { events: makeEventRows(g, 5), activities: [] };
    resolveExperimentForScope.mockResolvedValue({
      experimentId: 'exp-1',
      variant: 'b',
      payload: { title: 'EXP TITLE' },
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: g.slug }) });

    expect(metadata.robots).toBeUndefined();
    expect(metaTitle(metadata)).toBe('EXP TITLE');
    expect(resolveExperimentForScope).toHaveBeenCalledTimes(1);
  });

  it('Fall (c): mixed -> Experiment DEAKTIVIERT, kombinierte Copy gewinnt', async () => {
    const g = nonCity[3];
    dbRows = { events: makeEventRows(g, 5), activities: makeActivityRows(g, 5) };
    resolveExperimentForScope.mockResolvedValue({
      experimentId: 'exp-1',
      variant: 'b',
      payload: { title: 'EXP TITLE' },
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: g.slug }) });

    expect(metaTitle(metadata)).toContain('Events & Freizeitaktivitäten in');
    expect(metadata.description).toContain('5 Veranstaltungen');
    expect(metadata.description).toContain('5 Freizeitaktivitäten');
    expect(resolveExperimentForScope).not.toHaveBeenCalled();
  });

  it('generateMetadata + Page mit identischen Args -> genau EIN Query pro Tabelle', async () => {
    const g = nonCity[4];
    dbRows = { events: makeEventRows(g, 4), activities: makeActivityRows(g, 4) };

    await generateMetadata({ params: Promise.resolve({ slug: g.slug }) });
    await GemeindeHubPage({ params: Promise.resolve({ slug: g.slug }) });

    expect(fromCounts['events']).toBe(1);
    expect(fromCounts['poi_activities']).toBe(1);
  });

  it('Fall (b) Page-Body: Aktivitaets-Hero statt Empty-State, JSON-LD ohne Event-ItemList', async () => {
    const g = nonCity[5];
    dbRows = { events: [], activities: makeActivityRows(g, 4) };

    const tree = await GemeindeHubPage({ params: Promise.resolve({ slug: g.slug }) });
    const out: { texts: string[]; scripts: string[] } = { texts: [], scripts: [] };
    collect(tree, out);
    const text = out.texts.join(' ');

    // Aktivitaets-Copy als Hauptinhalt …
    expect(text).toContain('Freizeitaktivitäten und Ausflugsziele');
    // … der Empty-State-Absatz ("Schau in einer Nachbar-Gemeinde nach")
    // erscheint NICHT mehr, nur der kleine Sektionshinweis.
    expect(text).not.toContain('Schau in einer Nachbar-Gemeinde nach');
    expect(text).toContain('Aktuell keine Events im Umkreis um');

    // JSON-LD: keine Event-ItemList, Aktivitaeten-ItemList vorhanden.
    expect(out.scripts.length).toBeGreaterThan(0);
    const graph = JSON.parse(out.scripts[0])['@graph'] as Array<Record<string, unknown>>;
    expect(graph.some((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith('#itemlist'))).toBe(false);
    expect(graph.some((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith('#activitylist'))).toBe(true);
    expect(graph.some((n) => n['@type'] === 'FAQPage')).toBe(true);
  });
});
