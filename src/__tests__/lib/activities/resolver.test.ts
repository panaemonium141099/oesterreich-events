import { describe, it, expect } from 'vitest';
import {
  resolveActivitySlug,
  type ActivityResolverRow,
  type ActivityResolverStore,
} from '@/lib/activities/resolver';
import { activityShortId, buildActivitySlug } from '@/lib/activities/slug';

/** In-Memory-Store ueber Rows — gleiche Semantik wie der Supabase-Adapter. */
function makeStore(rows: ActivityResolverRow[]): ActivityResolverStore & {
  shortidOf: Map<string, ActivityResolverRow>;
} {
  const shortidOf = new Map<string, ActivityResolverRow>();
  for (const row of rows) {
    // shortid = letzter Slug-Token (Rows in den Tests sind mit
    // buildActivitySlug erzeugt, der Suffix IST die shortid-Spalte).
    shortidOf.set(row.slug.slice(row.slug.lastIndexOf('-') + 1), row);
  }
  return {
    shortidOf,
    getBySlug: async (slug) => rows.find((r) => r.slug === slug) ?? null,
    getByShortId: async (shortid) => shortidOf.get(shortid) ?? null,
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
  };
}

function row(overrides: Partial<ActivityResolverRow> & { id: string; slug: string }): ActivityResolverRow {
  return { visible: true, is_closed: false, duplicate_of: null, ...overrides };
}

const SHORTID = activityShortId('deskline', 'INFRA-1');
const SLUG = buildActivitySlug('Mountaincart Fulseck', 'deskline', 'INFRA-1');

describe('resolveActivitySlug — Resolver-Contract (Task-Spec)', () => {
  it('sichtbare Row mit exaktem Slug -> render', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG })]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'render', id: 'a1' });
  });

  it('alter/abweichender Slug mit gueltiger Shortid -> 301 auf aktuellen Slug', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG })]);
    // Name hat sich geaendert, alte URL traegt noch die alte Name-Haelfte.
    const staleSlug = `alter-name-${SHORTID}`;
    expect(await resolveActivitySlug(staleSlug, store)).toEqual({ outcome: 'redirect', slug: SLUG });
  });

  it('unbekannter Slug ohne extrahierbare Shortid -> 404', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG })]);
    expect(await resolveActivitySlug('gibt-es-nicht', store)).toEqual({ outcome: 'not-found' });
  });

  it('unsichtbare duplicate_of-Row mit LEBENDEM Canonical -> 301 auf kanonische URL', async () => {
    const canonical = row({ id: 'c1', slug: 'kanonisch-aaaaaaaaaaaa' });
    const dupe = row({
      id: 'd1',
      slug: SLUG,
      visible: false,
      duplicate_of: 'c1',
    });
    const store = makeStore([canonical, dupe]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({
      outcome: 'redirect',
      slug: 'kanonisch-aaaaaaaaaaaa',
    });
  });

  it('duplicate_of-Row mit totem/unsichtbarem Canonical -> 404 (kein 301->404-Chaining)', async () => {
    const deadCanonical = row({ id: 'c1', slug: 'tot-aaaaaaaaaaaa', visible: false });
    const dupe = row({ id: 'd1', slug: SLUG, visible: false, duplicate_of: 'c1' });
    const store = makeStore([deadCanonical, dupe]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'not-found' });
  });

  it('duplicate_of-Row mit FEHLENDEM Canonical -> 404', async () => {
    const dupe = row({ id: 'd1', slug: SLUG, visible: false, duplicate_of: 'missing' });
    const store = makeStore([dupe]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'not-found' });
  });

  it('geprunte Row (visible=false, duplicate_of leer) -> 404', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG, visible: false })]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'not-found' });
  });

  it('geprunte Row -> 404 AUCH via Shortid-Fallback (nie wiederbeleben)', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG, visible: false })]);
    const staleSlug = `alter-name-${SHORTID}`;
    expect(await resolveActivitySlug(staleSlug, store)).toEqual({ outcome: 'not-found' });
  });

  it('defensiver Selbst-Verweis (duplicate_of = eigene id) -> 404, keine Schleife', async () => {
    const store = makeStore([
      row({ id: 'a1', slug: SLUG, visible: false, duplicate_of: 'a1' }),
    ]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'not-found' });
  });

  it('is_closed-Row (visible=true) -> RENDERN (Seite bleibt erreichbar, noindex via Gate)', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG, is_closed: true })]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({ outcome: 'render', id: 'a1' });
  });

  it('is_closed-Row via Shortid-Fallback -> 301 auf aktuellen Slug (rendert dort)', async () => {
    const store = makeStore([row({ id: 'a1', slug: SLUG, is_closed: true })]);
    const staleSlug = `alter-name-${SHORTID}`;
    expect(await resolveActivitySlug(staleSlug, store)).toEqual({ outcome: 'redirect', slug: SLUG });
  });

  it('301 auf ein is_closed-Canonical ist erlaubt (rendert dort, kein 404)', async () => {
    const closedCanonical = row({ id: 'c1', slug: 'zu-aaaaaaaaaaaa', is_closed: true });
    const dupe = row({ id: 'd1', slug: SLUG, visible: false, duplicate_of: 'c1' });
    const store = makeStore([closedCanonical, dupe]);
    expect(await resolveActivitySlug(SLUG, store)).toEqual({
      outcome: 'redirect',
      slug: 'zu-aaaaaaaaaaaa',
    });
  });

  it('leerer Slug-Parameter -> 404', async () => {
    const store = makeStore([]);
    expect(await resolveActivitySlug('', store)).toEqual({ outcome: 'not-found' });
  });
});
