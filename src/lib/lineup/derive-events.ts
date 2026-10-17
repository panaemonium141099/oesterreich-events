/**
 * Derived Event Generator for Festival Lineups
 *
 * For each festival_artists row:
 *   1. Compose title: "{artist_name_raw} at {festival.canonical_name}"
 *   2. Location: inherited from the parent event (festivals.parent_event_id),
 *      otherwise decided by the shared resolver from the festival's place
 *   3. Set source_type = 'derived', source_name = 'festival-lineup'
 *   4. Generate content_fingerprint via generateFingerprint()
 *   5. Not yet derived: upsert into events (ON CONFLICT source_name,source_id)
 *      and backlink festival_artists.derived_event_id
 *   6. Already derived: bring the location up to date when the decision
 *      changed, and confirm the row (last_seen_at) like a scraper delivery
 *
 * Derived events bypass deduplicateEvents() (the in-run dedup of a scraper
 * batch); the cross-source dedup step sees them like any other row.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Festival, FestivalArtist } from '@/types/festivals';
import type { Event } from '@/types/events';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { bundeslandToId } from '@/lib/bundeslaender';
import { bundeslandForLocation, districtForLocation } from '@/lib/plz-district';
import { resolveEventLocation } from '@/lib/location/resolver';
import type { LocationDecision } from '@/lib/location/types';
import { fetchAllRows } from '@/lib/db/fetch-all';
import { generateEventSlug } from '@/lib/utils/slugify';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeriveEventsOptions {
  /** Only derive events for a specific festival slug */
  festivalSlug?: string;
  /** Verbose logging */
  verbose?: boolean;
}

export interface DeriveEventsResult {
  events_created: number;
  events_backlinked: number;
  /** Bestehende Zeilen, deren Ortsangaben (oder fehlender Slug) nachgezogen wurden. */
  events_updated: number;
  /** Bestehende Zeilen, die dieser Lauf bestätigt hat (last_seen_at). */
  events_confirmed: number;
  /** Lese- und Schreibfehler: der Pipeline-Schritt wird damit rot. */
  errors: string[];
  /** Zeilen ohne Datum oder Fingerprint: unvollständige Festivaldaten, kein Fehler. */
  skipped: string[];
}

/** Ortsspalten, die der Derive-Lauf für ein abgeleitetes Event führt. */
export interface DerivedLocation {
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  country: string;
  city_raw: string | null;
  country_raw: string | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
  location_status: string | null;
  location_precision: string | null;
  location_resolution: Record<string, unknown> | null;
  location_provenance: Record<string, string> | null;
  venue_id: string | null;
}

/** Gespeicherter Stand einer abgeleiteten Zeile, soweit der Abgleich ihn braucht. */
interface StoredDerivedRow {
  id: string;
  source_id: string | null;
  title: string;
  slug: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  city_raw: string | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
  location_status: string | null;
  location_precision: string | null;
  venue_id: string | null;
  stored_input_hash: string | null;
}

const STORED_COLUMNS =
  'id, source_id, title, slug, location_name, address, postal_code, bundesland, district, latitude, longitude, country, city_raw, ' +
  'geocoding_confidence, geocoding_source, location_status, location_precision, venue_id, ' +
  'stored_input_hash:location_resolution->>input_hash';

// PostgREST trägt .in()-Listen im Query-String: höchstens 200 Ids je Aufruf.
const CHUNK = 200;

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string, verbose = true): void {
  if (!verbose) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [derive-events] ${message}`);
}

/**
 * Resolve the start_date for a derived event.
 *
 * Priority:
 *   1. day_label if it looks like an ISO date (YYYY-MM-DD)
 *   2. festival.starts_at
 *   3. null (caller must handle)
 */
function resolveStartDate(
  dayLabel: string | null,
  festival: Festival
): string | null {
  // Try day_label as ISO date
  if (dayLabel) {
    const isoDateMatch = dayLabel.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      return isoDateMatch[1];
    }
  }

  // Fall back to festival start date
  if (festival.starts_at) {
    return festival.starts_at.slice(0, 10);
  }

  return null;
}

/**
 * Ortsangaben eines abgeleiteten Events, über dieselben Funktionen wie der
 * Schreibpfad der Scraper (Resolver, `bundeslandForLocation`,
 * `districtForLocation`).
 *
 * Mit Eltern-Event gilt dessen Ortsentscheidung. Ohne Eltern-Event entscheidet
 * der Resolver über den Festival-Ort, wie im Sync für eine Quelle, die nur
 * einen Ort nennt: eindeutiger Gemeindename → Gemeinde-Mittelpunkt mit
 * Status `municipality_only`, Genauigkeit `municipality`, ohne Pin; sonst
 * keine Position. Prod 2026-10-17: kein Festival mit Lineup hat ein
 * Eltern-Event, die Treffer in events sind Einzelauftritte oder liegen
 * woanders. Bis dahin standen alle 839 Lineup-Events ohne Koordinate da und
 * fielen aus Liste und Karte.
 *
 * `festivals.state` geht nicht in die Entscheidung ein und ist nur der
 * Rückfall fürs Bundesland. Der Wert ist von Hand gepflegt und steht als
 * Anzeigename da („Niederösterreich"); als Spaltenwert verletzte er
 * events_bundesland_check, jede Nacht für alle 839 Zeilen. Er ist zudem teils
 * falsch: Nova Rock steht in Niederösterreich, Nickelsdorf liegt im
 * Burgenland; Mondsee steht in Salzburg, liegt aber in Oberösterreich. Als
 * Bundesland der Quelle hätte er Nickelsdorf gar nicht erst gefunden.
 *
 * `city_raw`/`country_raw` tragen die Eingabe, damit die Entscheidung aus der
 * Zeile wiederholbar ist (`inputFromStoredRow`); der Titel gehört wie im Sync
 * zur Eingabe.
 */
export function derivedEventLocation(
  festival: Pick<Festival, 'city' | 'state'>,
  parent: Partial<Event> | null,
  title: string | null = null,
): DerivedLocation {
  if (parent) {
    const gemeinde = (parent.location_resolution as { gemeinde?: LocationDecision['gemeinde'] } | null | undefined)?.gemeinde ?? null;
    const bundesland =
      bundeslandForLocation(parent.bundesland, gemeinde, parent.postal_code) ?? bundeslandToId(festival.state);
    return {
      location_name: parent.location_name ?? festival.city ?? null,
      address: parent.address ?? null,
      postal_code: parent.postal_code ?? null,
      bundesland,
      district: parent.district ?? null,
      latitude: parent.latitude ?? null,
      longitude: parent.longitude ?? null,
      country: parent.country ?? 'AT',
      city_raw: null,
      country_raw: null,
      geocoding_confidence: parent.geocoding_confidence ?? null,
      geocoding_source: parent.geocoding_source ?? null,
      location_status: parent.location_status ?? null,
      location_precision: parent.location_precision ?? null,
      location_resolution: { ...(parent.location_resolution ?? {}), inherited_from_event: parent.id ?? null },
      location_provenance: parent.location_provenance ?? null,
      venue_id: parent.venue_id ?? null,
    };
  }
  const decision = resolveEventLocation({ title, city: festival.city, country: 'AT' });
  const bundesland = bundeslandForLocation(null, decision.gemeinde, decision.postal_code) ?? bundeslandToId(festival.state);
  const district = districtForLocation(
    decision.gemeinde,
    decision.postal_code,
    bundesland,
    null,
    decision.provenance.postal_code ?? null,
  );
  return {
    location_name: decision.location_name,
    address: null,
    postal_code: decision.postal_code,
    bundesland,
    district,
    latitude: decision.latitude,
    longitude: decision.longitude,
    country: decision.country,
    city_raw: festival.city ?? null,
    country_raw: 'AT',
    geocoding_confidence: decision.geocoding_confidence,
    geocoding_source: decision.geocoding_source,
    location_status: decision.status,
    location_precision: decision.precision,
    location_resolution: decision as unknown as Record<string, unknown>,
    location_provenance: decision.provenance as Record<string, string>,
    venue_id: decision.venue_id,
  };
}

/** Spalten, deren Abweichung ein Nachziehen auslöst (dazu der Eingabehash). */
const COMPARED_COLUMNS = [
  'location_name', 'address', 'postal_code', 'bundesland', 'district', 'country', 'city_raw',
  'geocoding_confidence', 'geocoding_source', 'location_status', 'location_precision', 'venue_id',
] as const;

function samePosition(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < 1e-6;
}

/**
 * Weicht die gespeicherte Ortsangabe von der aktuellen Entscheidung ab? Der
 * Zeitstempel der Entscheidung zählt nicht, sonst schriebe jeder Lauf alle
 * Zeilen neu.
 */
export function derivedLocationChanged(stored: Omit<StoredDerivedRow, 'id' | 'source_id' | 'title' | 'slug'>, loc: DerivedLocation): boolean {
  if (COMPARED_COLUMNS.some(k => (stored[k] ?? null) !== (loc[k] ?? null))) return true;
  if (!samePosition(stored.latitude, loc.latitude) || !samePosition(stored.longitude, loc.longitude)) return true;
  const hash = (loc.location_resolution as { input_hash?: string } | null)?.input_hash ?? null;
  return (stored.stored_input_hash ?? null) !== hash;
}

/**
 * Fetch the parent event for a festival (to inherit location data).
 */
async function fetchParentEvent(
  supabase: SupabaseClient,
  parentEventId: string
): Promise<Partial<Event> | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, location_name, address, postal_code, bundesland, district, country, latitude, longitude, category, image_url, ' +
        'geocoding_confidence, geocoding_source, location_status, location_precision, location_resolution, location_provenance, venue_id'
    )
    .eq('id', parentEventId)
    .single();

  if (error || !data) return null;
  return data as Partial<Event>;
}

// ── Core derivation ─────────────────────────────────────────────────────────

/**
 * Generate derived events and keep the existing ones current.
 *
 * Für jede festival_artists-Zeile:
 *   - noch nicht abgeleitet: „{Artist} at {Festival}" anlegen und verlinken
 *   - abgeleitet: Ortsangaben nachziehen, wenn sich die Entscheidung geändert
 *     hat, sonst nur bestätigen
 *
 * Bis 2026-10-17 las der Lauf nur Zeilen mit derived_event_id IS NULL: eine
 * einmal angelegte Zeile bekam nie wieder einen Schreibzugriff. Ein Fix am Ort
 * erreichte den Bestand nicht, und `last_seen_at` blieb auf dem Anlagetag
 * stehen. Der Rückzug (`withdraw-stale-events`) hätte alle künftigen
 * Lineup-Events 30 Tage danach als „Quelle tot" verborgen.
 */
export async function deriveFestivalEvents(
  supabase: SupabaseClient,
  options: DeriveEventsOptions = {}
): Promise<DeriveEventsResult> {
  const verbose = options.verbose ?? false;
  const result: DeriveEventsResult = {
    events_created: 0,
    events_backlinked: 0,
    events_updated: 0,
    events_confirmed: 0,
    errors: [],
    skipped: [],
  };

  // 1. Fetch festival_artists rows (über 1.000 Zeilen: seitenweise, siehe fetch-all.ts)
  type ArtistRow = FestivalArtist & { festivals: Festival };
  let rows: ArtistRow[];
  let stored: StoredDerivedRow[];
  try {
    rows = await fetchAllRows<ArtistRow>(
      (from, to) => {
        let query = supabase.from('festival_artists').select('*, festivals!inner(*)');
        // The join syntax festivals!inner(*) gives us the festival data;
        // we filter on the joined table.
        if (options.festivalSlug) query = query.eq('festivals.slug', options.festivalSlug);
        return query.order('id').range(from, to);
      },
      { label: 'festival_artists' },
    );
    stored = await fetchAllRows<StoredDerivedRow>(
      (from, to) =>
        // Den Alias mit JSON-Pfad kann der Select-Parser von supabase-js nicht typisieren.
        supabase.from('events').select(STORED_COLUMNS).eq('source_name', 'festival-lineup').order('id')
          .range(from, to) as unknown as PromiseLike<{ data: StoredDerivedRow[] | null; error: { message: string } | null }>,
      { label: 'derived events' },
    );
  } catch (err) {
    result.errors.push(`Failed to fetch festival artists or derived events: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (rows.length === 0) {
    log('No festival_artists rows found', verbose);
    return result;
  }

  log(`Found ${rows.length} festival_artists rows, ${stored.length} derived events`, verbose);

  const storedById = new Map(stored.map(s => [s.id, s]));
  const storedBySourceId = new Map(stored.filter(s => s.source_id).map(s => [s.source_id!, s]));
  const nowIso = new Date().toISOString();
  const confirmIds: string[] = [];

  // 2. Group by festival to batch parent event lookups
  //    Each row has the joined festival data under the 'festivals' key
  const parentEventCache = new Map<string, Partial<Event> | null>();

  for (const artist of rows) {
    const festival = artist.festivals;

    if (!festival) {
      result.errors.push(
        `Artist row ${artist.id} has no festival data (festival_id: ${artist.festival_id})`
      );
      continue;
    }

    // 3. Compose the derived event title
    const title = `${artist.artist_name_raw} at ${festival.canonical_name}`;

    // Inherit location from parent event
    let locationData: Partial<Event> | null = null;
    if (festival.parent_event_id) {
      if (parentEventCache.has(festival.parent_event_id)) {
        locationData = parentEventCache.get(festival.parent_event_id) ?? null;
      } else {
        locationData = await fetchParentEvent(supabase, festival.parent_event_id);
        parentEventCache.set(festival.parent_event_id, locationData);
      }
    }

    // 4. Bereits abgeleitet: Ortsangaben nachziehen oder bestätigen. Die
    //    Zeile ist über die Verlinkung bekannt, Datum und Fingerprint braucht
    //    es dafür nicht.
    const linked = artist.derived_event_id ? storedById.get(artist.derived_event_id) : undefined;
    if (linked) {
      await refreshDerivedEvent(supabase, linked, derivedEventLocation(festival, locationData, linked.title), nowIso, confirmIds, result);
      continue;
    }

    // 5. Resolve start_date
    const startDate = resolveStartDate(artist.day_label, festival);
    if (!startDate) {
      log(
        `Skipping "${title}": no resolvable start_date (day_label=${artist.day_label}, festival.starts_at=${festival.starts_at})`,
        verbose
      );
      result.skipped.push(`No start_date for "${title}"`);
      continue;
    }

    // 6. Generate content fingerprint
    const fingerprint = generateFingerprint(title, startDate);
    if (!fingerprint) {
      log(`Skipping "${title}": could not generate fingerprint`, verbose);
      result.skipped.push(`No fingerprint for "${title}"`);
      continue;
    }

    // source_id: deterministic from fingerprint for ON CONFLICT
    const sourceId = `lineup-${festival.slug}-${fingerprint.slice(0, 16)}`;

    // Die Zeile gibt es schon, nur die Verlinkung fehlt (früher
    // gescheiterter Backlink): nachziehen statt überschreiben, der Slug bleibt.
    const existing = storedBySourceId.get(sourceId);
    if (existing) {
      await refreshDerivedEvent(supabase, existing, derivedEventLocation(festival, locationData, existing.title), nowIso, confirmIds, result);
      await backlink(supabase, artist, existing.id, result, verbose);
      continue;
    }

    // 7. Build the derived event row
    const location = derivedEventLocation(festival, locationData, title);
    const eventRow = {
      source_type: 'derived',
      source_name: 'festival-lineup',
      source_id: sourceId,
      source_url: festival.lineup_url ?? festival.website_url ?? null,
      title,
      description: artist.stage_name
        ? `${artist.artist_name_raw} performing at ${festival.canonical_name} (${artist.stage_name})`
        : `${artist.artist_name_raw} performing at ${festival.canonical_name}`,
      start_date: startDate,
      end_date: null as string | null,
      ...location,
      location_status_changed_at: nowIso,
      category: locationData?.category ?? 'Musik',
      image_url: locationData?.image_url ?? null,
      tags: ['Festival', 'Lineup'],
      parent_event_id: festival.parent_event_id ?? null,
      content_fingerprint: fingerprint,
      visibility: 'public',
      // Ohne Slug führt der Link der Karte (/events/{plz-ort}/{datum}/{slug})
      // ins Leere: die Detailseite sucht über (slug, datum).
      slug: generateEventSlug(title, location.location_name),
      last_seen_at: nowIso,
    };

    // 8. Upsert into events (standard upsert key source_name + source_id)
    const { data: upsertedData, error: upsertErr } = await supabase
      .from('events')
      .upsert(eventRow, {
        onConflict: 'source_name,source_id',
      })
      .select('id')
      .single();

    if (upsertErr) {
      log(`Error upserting derived event "${title}": ${upsertErr.message}`, true);
      result.errors.push(`Upsert error for "${title}": ${upsertErr.message}`);
      continue;
    }

    const eventId = upsertedData?.id;
    if (!eventId) {
      result.errors.push(`No event id returned for "${title}"`);
      continue;
    }

    result.events_created++;

    // 9. Backlink: update festival_artists.derived_event_id + touch updated_at
    await backlink(supabase, artist, eventId, result, verbose);
  }

  // 10. Bestätigen, was unverändert geblieben ist (ein Lauf, wie die
  //     Sichtung eines Scrapers). supabase-js wirft bei Schreibfehlern nicht:
  //     Fehler UND Zahl prüfen.
  for (let i = 0; i < confirmIds.length; i += CHUNK) {
    const chunk = confirmIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('events')
      .update({ last_seen_at: nowIso })
      .in('id', chunk)
      .select('id');
    if (error) {
      result.errors.push(`Confirm error for ${chunk.length} derived events: ${error.message}`);
      continue;
    }
    result.events_confirmed += data?.length ?? 0;
  }

  return result;
}

/**
 * Bestehende abgeleitete Zeile: nur Ortsangaben (und einen fehlenden Slug)
 * schreiben, und nur bei Abweichung. Kategorie, Tags, Veröffentlichung und
 * Dedup-Verweise gehören anderen Schritten und bleiben unberührt.
 */
async function refreshDerivedEvent(
  supabase: SupabaseClient,
  row: StoredDerivedRow,
  location: DerivedLocation,
  nowIso: string,
  confirmIds: string[],
  result: DeriveEventsResult,
): Promise<void> {
  const changed = derivedLocationChanged(row, location);
  if (!changed && row.slug) {
    confirmIds.push(row.id);
    return;
  }
  const payload = {
    ...(changed
      ? {
          ...location,
          ...(row.location_status !== location.location_status ? { location_status_changed_at: nowIso } : {}),
        }
      : {}),
    ...(row.slug ? {} : { slug: generateEventSlug(row.title, location.location_name) }),
    last_seen_at: nowIso,
  };
  const { data, error } = await supabase.from('events').update(payload).eq('id', row.id).select('id');
  if (error) {
    result.errors.push(`Update error for "${row.title}": ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    result.errors.push(`Update for "${row.title}" matched no row (${row.id})`);
    return;
  }
  result.events_updated++;
}

async function backlink(
  supabase: SupabaseClient,
  artist: FestivalArtist,
  eventId: string,
  result: DeriveEventsResult,
  verbose: boolean,
): Promise<void> {
  const { error: backlinkErr } = await supabase
    .from('festival_artists')
    .update({
      derived_event_id: eventId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artist.id);

  if (backlinkErr) {
    log(
      `Error backlinking artist "${artist.artist_name_raw}" to event ${eventId}: ${backlinkErr.message}`,
      true
    );
    result.errors.push(`Backlink error for "${artist.artist_name_raw}": ${backlinkErr.message}`);
  } else {
    result.events_backlinked++;
    log(`Derived event for "${artist.artist_name_raw}" -> ${eventId}`, verbose);
  }
}
