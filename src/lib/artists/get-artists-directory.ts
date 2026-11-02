/**
 * Lader des Künstlerverzeichnisses für /artists (Plakatwand, 2026-11).
 *
 * Liest alle Feed-Künstler mit Termin in Österreich in den nächsten
 * DIRECTORY_WINDOW_DAYS Tagen über den cookie-freien Anon-Client (die Seite
 * ist eine ISR-Shell wie die Startseite: kein cookies(), kein auth im
 * RSC-Pfad). PostgREST liefert höchstens 1000 Zeilen je Antwort, deshalb
 * seitenweise über `forEachPage` (Prod 2026-11-02: rund 5.300 Zeilen für
 * 120 Tage, Deckel DIRECTORY_MAX_ROWS). Unterdrückte Eventim-Zeilen holen
 * ihren Primary nach (≤ 200 IDs je Abfrage, PostgREST trägt `.in()` im
 * Query-String).
 *
 * Fehler: im Build leere Seite (ein Deploy darf nicht an der Tagesform der
 * DB scheitern), zur Laufzeit werfen, damit Next die letzte gute Seite
 * behält (gleiche Regel wie get-landing-data.ts).
 */

import { createClient } from '@supabase/supabase-js';
import { SITE_COUNTRY } from '@/lib/site-country';
import { forEachPage } from '@/lib/db/fetch-all';
import { EVENT_URL_COLUMNS } from '@/lib/utils/slugify';
import { plzReference } from '@/lib/location/plz-reference';
import { addViennaDays, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import { buildDirectory, unresolvedPrimaryIds, type DirectoryArtist, type DirectoryEventRow, type DirectoryRow } from './directory';

export const DIRECTORY_WINDOW_DAYS = 90;
export const DIRECTORY_MAX_ROWS = 8000;
const PRIMARY_CHUNK = 200;

export interface ArtistsDirectory {
  artists: DirectoryArtist[];
  /** Wiener Tag der Erzeugung (YYYY-MM-DD). */
  today: string;
  windowDays: number;
}

const EVENT_COLS = `${EVENT_URL_COLUMNS},title,country,publish_status,duplicate_of,category,tags,is_all_day,duration_type,ticket_url`;

type RawRow = Omit<DirectoryRow, 'event'> & { event: DirectoryEventRow | DirectoryEventRow[] | null };

const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build';

export function emptyDirectory(now: Date = new Date()): ArtistsDirectory {
  return { artists: [], today: viennaToday(now), windowDays: DIRECTORY_WINDOW_DAYS };
}

export async function getArtistsDirectory(now: Date = new Date()): Promise<ArtistsDirectory> {
  try {
    return await loadDirectory(now);
  } catch (err) {
    if (!isBuildPhase()) throw err;
    console.error('[artists] Verzeichnis im Build nicht ladbar, Seite leer:', err);
    return emptyDirectory(now);
  }
}

async function loadDirectory(now: Date): Promise<ArtistsDirectory> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const today = viennaToday(now);
  const nowIso = now.toISOString();
  const windowEnd = viennaDayStart(addViennaDays(today, DIRECTORY_WINDOW_DAYS)).toISOString();

  const rows: DirectoryRow[] = [];
  await forEachPage<RawRow>(
    (from, to) => supabase
      .from('event_artists')
      .select(`artist_id, artist_name, artist_image, evo_link, event:events!inner(${EVENT_COLS})`)
      .eq('event.country', SITE_COUNTRY)
      .or('publish_status.eq.published,duplicate_of.not.is.null', { referencedTable: 'event' })
      .gte('event.start_date', nowIso)
      .lt('event.start_date', windowEnd)
      .order('event_id')
      .order('artist_id')
      .range(from, to),
    (page) => {
      for (const r of page) {
        const event = Array.isArray(r.event) ? (r.event[0] ?? null) : r.event;
        rows.push({ ...r, event });
      }
    },
    { maxRows: DIRECTORY_MAX_ROWS, label: 'artists directory' },
  );

  const primaries = new Map<string, DirectoryEventRow>();
  const primaryIds = unresolvedPrimaryIds(rows);
  for (let i = 0; i < primaryIds.length; i += PRIMARY_CHUNK) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_COLS)
      .in('id', primaryIds.slice(i, i + PRIMARY_CHUNK))
      .eq('publish_status', 'published')
      .eq('country', SITE_COUNTRY);
    if (error) throw new Error(`[artists] Primaries: ${error.message}`);
    for (const e of (data ?? []) as unknown as DirectoryEventRow[]) primaries.set(e.id, e);
  }

  const cityOf = (plz: string) => plzReference(plz)?.orte[0] ?? null;
  return { artists: buildDirectory(rows, primaries, { cityOf }), today, windowDays: DIRECTORY_WINDOW_DAYS };
}
