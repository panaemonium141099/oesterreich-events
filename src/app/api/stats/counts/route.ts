import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Lazy Supabase client — validates env vars at call time, not module load time */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Display-form Bundesländer mit slug-/lowercase-Aliasen die wir mergen.
 * Daten haben historisch beide Varianten (z. B. 'Wien' AND 'wien' AND 'Wien'),
 * weil verschiedene Scraper unterschiedlich schreiben. Frontend braucht
 * eine Zahl pro Bundesland — also: lowercase + uppercase werden zur
 * uppercase-Variante summiert.
 */
const BUNDESLAND_ALIASES: Record<string, string> = {
  'Burgenland': 'Burgenland', 'burgenland': 'Burgenland',
  'Kärnten': 'Kärnten', 'kaernten': 'Kärnten', 'Kaernten': 'Kärnten',
  'Niederösterreich': 'Niederösterreich', 'niederoesterreich': 'Niederösterreich', 'Niederoesterreich': 'Niederösterreich',
  'Oberösterreich': 'Oberösterreich', 'oberoesterreich': 'Oberösterreich', 'Oberoesterreich': 'Oberösterreich', 'ooe': 'Oberösterreich',
  'Salzburg': 'Salzburg', 'salzburg': 'Salzburg',
  'Steiermark': 'Steiermark', 'steiermark': 'Steiermark',
  'Tirol': 'Tirol', 'tirol': 'Tirol',
  'Vorarlberg': 'Vorarlberg', 'vorarlberg': 'Vorarlberg',
  'Wien': 'Wien', 'wien': 'Wien',
};

interface CountsPayload {
  regions: Record<string, number>;
  categories: Record<string, number>;
  total: number;
  dedup_total: number;
}

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable', code: 'ENV_MISSING' },
      { status: 503 }
    );
  }

  try {
    // EINE RPC statt 21 individuelle counts. Server-side GROUP BY
    // aggregation auf events. Returns { regions, categories, total }
    // wo total = map-equivalent (publishable + geocoded + bbox).
    // Migration: 20260429110000_stats_counts_rpc.sql
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('event_counts_for_stats');

    if (error) {
      console.error('event_counts_for_stats RPC error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Event-Statistiken' },
        { status: 500 }
      );
    }

    const payload = (data ?? {}) as CountsPayload;

    // Merge lowercase/slug-variants in display-form bundesland
    const mergedRegions: Record<string, number> = {};
    for (const [name, count] of Object.entries(payload.regions ?? {})) {
      const display = BUNDESLAND_ALIASES[name];
      if (!display || count <= 0) continue;
      mergedRegions[display] = (mergedRegions[display] ?? 0) + count;
    }

    const categories: Record<string, number> = {};
    for (const [name, count] of Object.entries(payload.categories ?? {})) {
      if (count > 0) categories[name] = count;
    }

    return NextResponse.json(
      {
        regions: mergedRegions,
        categories,
        total: payload.total ?? 0,
        // dedup_total = was die Map als "X Veranstaltungen" zeigt (post
        // client-side title+date dedup). LandingStats nutzt das damit
        // beide Zahlen matchen.
        dedup_total: payload.dedup_total ?? 0,
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('API Error (stats/counts):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Event-Statistiken' },
      { status: 500 }
    );
  }
}
