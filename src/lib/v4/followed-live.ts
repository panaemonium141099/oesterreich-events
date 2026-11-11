/**
 * „Diese Woche live" für Eingeloggte (fn-30.4). Pur, ohne I/O.
 *
 * `/api/me/landing` holt die gefolgten Namen eines Nutzers und die
 * Feed-Künstler (event_artists) mit Termin in den nächsten sieben Wiener
 * Tagen; hier fällt die Entscheidung, welche Zeilen zum Nutzer passen.
 * Der Abgleich läuft auf beiden Seiten über `normalizeArtistName`
 * (followed_artists.artist_name_normalized ist nur `lower()`).
 *
 * Die SQL-Vorauswahl (`artistNameFilter`) ist nur ein Netz, damit nicht der
 * ganze Wochenpool über die Leitung geht: `ilike` ohne Platzhalter ist ein
 * Vergleich ohne Groß-/Kleinschreibung, Diakritika unterscheidet er aber.
 * Deshalb geht jeder Name roh und normalisiert mit, und `pickFollowedLive`
 * entscheidet am Ende in JS.
 */

import type { Event } from '@/types/events';
import { normalizeArtistName } from '@/lib/artists/normalize-name';
import type { ArtistEventRow, LandingArtistLive } from './landing-picks';

/** Namen je Abfrage; PostgREST trägt Filter im Query-String (≤ 200 Muster). */
export const FOLLOWED_NAME_CHUNK = 100;
/** Zeilen je Abfrage (PostgREST kappt ohnehin bei 1000). */
export const FOLLOWED_LIVE_POOL = 200;
/** Zeilen der Kachel; so viele zeigt auch die statische Rotation. */
export const ARTISTS_LIVE_ROWS = 3;

/** Alle gefolgten Namen normalisiert, ohne Leere und Dubletten, in Reihenfolge. */
export function normalizeFollowedNames(rows: Array<{ artist_name: string | null }>): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    const n = normalizeArtistName(r.artist_name ?? '');
    if (n) out.add(n);
  }
  return [...out];
}

export function chunkNames(names: string[], size = FOLLOWED_NAME_CHUNK): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += size) chunks.push(names.slice(i, i + size));
  return chunks;
}

/**
 * Wert für einen PostgREST-Logikfilter in Anführungszeichen: Komma,
 * Klammer und Punkt im Namen („Earth, Wind & Fire") bleiben Teil des Werts;
 * Anführungszeichen und Backslash werden mit Backslash geschützt.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * `or`-Filter auf event_artists.artist_name: je Name ein `ilike` roh (so,
 * wie der Nutzer ihn eingetragen hat) und, falls abweichend, normalisiert.
 * Leerer String, wenn kein Name übrig bleibt (dann keine Abfrage).
 */
export function artistNameFilter(names: string[]): string {
  const patterns = new Set<string>();
  for (const raw of names) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    patterns.add(trimmed);
    const normalized = normalizeArtistName(trimmed);
    if (normalized !== trimmed.toLowerCase()) patterns.add(normalized);
  }
  return [...patterns].map(p => `artist_name.ilike.${quotePostgrestValue(p)}`).join(',');
}

/** Sichtbarer Termin einer Pool-Zeile: die Zeile selbst oder ihr Primary. */
function visibleEvent(row: ArtistEventRow, primaries: Map<string, Event>): Event | null {
  if (row.event.publish_status === 'published') return row.event;
  const primary = row.event.duplicate_of ? primaries.get(row.event.duplicate_of) : null;
  return primary && primary.publish_status === 'published' ? primary : null;
}

/**
 * Gefolgte Künstler mit Termin: je Künstler der nächste sichtbare Termin,
 * sortiert nach Datum, dann Name. Unterdrückte Eventim-Zeilen zeigen den
 * Primary, ohne Primary fallen sie weg. `followed` enthält normalisierte Namen.
 */
export function pickFollowedLive(
  rows: ArtistEventRow[],
  primaries: Map<string, Event>,
  followed: Set<string>,
): LandingArtistLive[] {
  const byArtist = new Map<string, LandingArtistLive>();
  for (const r of rows) {
    const event = visibleEvent(r, primaries);
    if (!event) continue;
    for (const a of r.artists ?? []) {
      const name = (a.artist_name ?? '').trim();
      if (!a.artist_id || !name || !followed.has(normalizeArtistName(name))) continue;
      const image = a.artist_image?.trim() || null;
      const prev = byArtist.get(a.artist_id);
      if (!prev) {
        byArtist.set(a.artist_id, { artistId: a.artist_id, name, image, evoLink: a.evo_link ?? null, event });
        continue;
      }
      if (event.start_date < prev.event.start_date) prev.event = event;
      if (!prev.image && image) prev.image = image;
    }
  }
  return [...byArtist.values()].sort(
    (a, b) => a.event.start_date.localeCompare(b.event.start_date) || a.name.localeCompare(b.name),
  );
}

/**
 * Zeilen der Kachel nach dem Laden: gefolgte Künstler zuerst, dann die
 * statische Rotation ohne Dubletten (gleiche artistId oder gleicher
 * normalisierter Name), höchstens `count` Zeilen.
 */
export function mergeArtistsLive(
  followedLive: LandingArtistLive[],
  rotation: LandingArtistLive[],
  count = ARTISTS_LIVE_ROWS,
): LandingArtistLive[] {
  const out: LandingArtistLive[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const a of [...followedLive, ...rotation]) {
    const key = normalizeArtistName(a.name);
    if (ids.has(a.artistId) || names.has(key)) continue;
    ids.add(a.artistId);
    names.add(key);
    out.push(a);
    if (out.length >= count) break;
  }
  return out;
}
