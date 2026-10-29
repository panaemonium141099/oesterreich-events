/**
 * Wächter für die Datenbank-Grundlage der Tagesausgabe (fn-30.1):
 *   * event_artists (20261029200000): neue Tabelle in public. Der Event-Trigger
 *     api_rollen_neue_objekte_absichern schaltet RLS ein; ohne Select-Policy
 *     für anon liefert die Tabelle der Startseite (Anon-Client) still nichts,
 *     und ohne FK im Schema-Cache scheitert das Embedding `events!inner`.
 *   * landing_features.kind / sponsor_name (20261029200100): Bestand wird
 *     editorial, sponsored verlangt den Sponsornamen (Kennzeichnungspflicht).
 *   * event_stats_cache.country_total (20261029200200): nur Österreich,
 *     nur published, nur kommende Events; die übrigen Felder bleiben.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Windows-Checkouts mit core.autocrlf liefern \r\n: Zeilenenden normalisieren,
// damit mehrzeilige Muster auf jedem System greifen.
const read = (file: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8').replace(/\r\n/g, '\n');

const artists = read('20261029200000_event_artists.sql');
const kind = read('20261029200100_landing_features_kind.sql');
const stats = read('20261029200200_stats_country_total.sql');

describe('event_artists migration', () => {
  it('legt die Tabelle mit PK (event_id, artist_id) und FK-Cascade auf events an', () => {
    expect(artists).toMatch(/create table if not exists public\.event_artists \(/);
    expect(artists).toMatch(/event_id uuid not null references public\.events\(id\) on delete cascade/);
    expect(artists).toMatch(/artist_id text not null/);
    expect(artists).toMatch(/artist_name text not null/);
    expect(artists).toMatch(/source text not null default 'eventim'/);
    expect(artists).toMatch(/updated_at timestamptz not null default now\(\)/);
    expect(artists).toMatch(/primary key \(event_id, artist_id\)/);
  });

  it('hat beide Indizes', () => {
    expect(artists).toMatch(/create index if not exists event_artists_artist_id_idx\s+on public\.event_artists \(artist_id\)/);
    expect(artists).toMatch(/create index if not exists event_artists_artist_name_idx\s+on public\.event_artists \(lower\(artist_name\)\)/);
  });

  it('schaltet RLS ein und gibt anon/authenticated eine Select-Policy', () => {
    expect(artists).toMatch(/alter table public\.event_artists enable row level security/);
    expect(artists).toMatch(
      /create policy event_artists_public_read\s+on public\.event_artists for select\s+to anon, authenticated\s+using \(true\)/,
    );
    // Keine Schreib-Policy: nur der Import mit Service-Role schreibt.
    expect(artists).not.toMatch(/for (insert|update|delete|all)/i);
  });

  it('vergibt Leserecht an anon/authenticated und alles an service_role', () => {
    expect(artists).toMatch(/grant select on public\.event_artists to anon, authenticated/);
    expect(artists).toMatch(/grant all on public\.event_artists to service_role/);
  });

  it('nennt den PostgREST-Schema-Reload als Pflichtschritt', () => {
    expect(artists).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });
});

describe('landing_features kind migration', () => {
  it('fügt kind mit Default editorial und sponsor_name hinzu', () => {
    expect(kind).toMatch(/add column if not exists kind text not null default 'editorial'/);
    expect(kind).toMatch(/add column if not exists sponsor_name text/);
  });

  it('setzt den Bestand auf editorial', () => {
    expect(kind).toMatch(/update public\.landing_features set kind = 'editorial'/);
  });

  it('prüft kind und verlangt bei sponsored den Sponsornamen', () => {
    expect(kind).toMatch(/check \(kind in \('sponsored', 'editorial'\)\)/);
    expect(kind).toMatch(/check \(kind <> 'sponsored' or sponsor_name is not null\)/);
  });

  it('nennt den PostgREST-Schema-Reload als Pflichtschritt', () => {
    expect(kind).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });
});

describe('event_stats_cache country_total migration', () => {
  // Der Kopfkommentar nennt „WITH DATA“ ebenfalls, deshalb lastIndexOf.
  const mv = stats.slice(stats.indexOf('CREATE MATERIALIZED VIEW'), stats.lastIndexOf('WITH DATA'));
  const countryAgg = mv.slice(mv.indexOf('country_total_agg AS'), mv.indexOf('SELECT\n  1 AS id'));

  it('baut die MV neu und behält alle bisherigen Felder', () => {
    expect(stats).toMatch(/DROP MATERIALIZED VIEW IF EXISTS public\.event_stats_cache/);
    for (const key of ['regions', 'categories', 'total', 'dedup_total', 'country_total']) {
      expect(mv).toContain(`'${key}',`);
    }
  });

  it('zählt country_total nur für Österreich, published und kommende Events', () => {
    // base filtert das Land; der Zähler ergänzt Status und Zeitpunkt.
    expect(mv).toMatch(/WITH base AS \([\s\S]*?country = 'AT'[\s\S]*?\),/);
    expect(countryAgg).toMatch(/publish_status = 'published'/);
    expect(countryAgg).toMatch(/start_date >= now\(\)/);
    expect(countryAgg).not.toMatch(/published_low_confidence/);
    expect(countryAgg).not.toMatch(/latitude|longitude/);
  });

  it('legt den Unique-Index für REFRESH CONCURRENTLY wieder an und sperrt die MV für anon', () => {
    expect(stats).toMatch(/CREATE UNIQUE INDEX event_stats_cache_id_key ON public\.event_stats_cache \(id\)/);
    expect(stats).toMatch(/REVOKE ALL ON public\.event_stats_cache FROM PUBLIC, anon, authenticated/);
    expect(stats).toMatch(/GRANT SELECT ON public\.event_stats_cache TO service_role/);
  });

  it('hält die RPC lesend, öffentlich und mit Schema-Reload', () => {
    const fn = stats.slice(stats.indexOf('CREATE OR REPLACE FUNCTION public.event_counts_for_stats'));
    expect(fn).toMatch(/SELECT payload FROM public\.event_stats_cache WHERE id = 1;/);
    expect(fn).not.toMatch(/\b(update|insert|delete)\b/i);
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION public\.event_counts_for_stats\(\) TO anon, authenticated, service_role/);
    expect(stats).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});
