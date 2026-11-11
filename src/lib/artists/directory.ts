/**
 * Künstlerverzeichnis des Künstler-Tabs (Plakatwand, 2026-11): pur, ohne I/O.
 *
 * Quelle sind die Feed-Künstler aus `event_artists` (Eventim, je Zeile ein
 * Künstler an einem Event) mit ihren sichtbaren Terminen in Österreich.
 * Hier fällt die Entscheidung, wer als Künstler gilt, welche Spielart er
 * hat und in welchem Regal er steht; `get-artists-directory.ts` liest die
 * Zeilen, die Seite rendert das Ergebnis.
 *
 * Unterdrückte Eventim-Zeilen (Dedup, `duplicate_of`) zeigen den sichtbaren
 * Primary, ohne Primary fallen sie weg (gleiche Regel wie die Kachel
 * „Diese Woche live“ in followed-live.ts).
 *
 * Häuser und Reihen: der Feed führt auch Spielstätten als „Künstler“
 * (Burgtheater mit 30 Terminen, Graz Tourismus, Dschungel Wien, Spanische
 * Hofreitschule) und Ausstellungen (House of Banksy). Ein Name, der mit
 * seinem eigenen Veranstaltungsort übereinstimmt, ist ein Haus; Termine
 * ohne Bühnenprogramm (Ausstellung, Messe, Kino, Sport) sind keine
 * Auftritte. Beide bleiben draußen.
 */

import { normalizeArtistName } from './normalize-name';
import { slugifyPlace } from '@/lib/utils/slugify';
import { addViennaDays, toViennaDate } from '@/lib/utils/event-time';

/** Spielarten für Regale und Filter. */
export type ArtistKind = 'konzert' | 'kabarett' | 'buehne' | 'klassik' | 'sonstiges';

/** Termin eines Künstlers; nur die Spalten, die Karte, Blatt und URL brauchen. */
export interface DirectoryEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  location_name: string | null;
  /** Post-Ort der PLZ (der Lader setzt ihn über plz-reference, serverseitig). */
  city?: string | null;
  /** Ticketlink des Termins (Eventim mit affiliate=J70); ohne ihn zeigt das Blatt den Künstlerlink. */
  ticket_url?: string | null;
  is_all_day?: boolean | null;
  duration_type?: string | null;
}

export interface DirectoryArtist {
  id: string;
  name: string;
  /** URL-Teil der Künstlerseite (/kuenstler/<slug>), aus dem Namen (artistSlug). */
  slug: string;
  image: string | null;
  /** Affiliate-Link der Künstlerseite bei oeticket (enthält affiliate=J70). */
  evoLink: string | null;
  kind: ArtistKind;
  /** Häufigster Genre-Tag der Termine („kabarett“, „rock“), für die Beschriftung. */
  genre: string | null;
  /** Kommende Termine, nach Datum, höchstens MAX_EVENTS_PER_ARTIST. */
  events: DirectoryEvent[];
}

/** Zeile der Abfrage: ein Künstler an einem Event. */
export interface DirectoryRow {
  artist_id: string;
  artist_name: string | null;
  artist_image: string | null;
  evo_link: string | null;
  event: DirectoryEventRow | null;
}

export interface DirectoryEventRow extends DirectoryEvent {
  publish_status?: string | null;
  duplicate_of?: string | null;
  category?: string | null;
  tags?: string[] | null;
}

export const MAX_EVENTS_PER_ARTIST = 20;
/** Karten je Regal. */
export const SHELF_SIZE = 16;
/** Ein Regal erscheint erst ab so vielen Künstlern. */
export const SHELF_MIN = 4;

const KIND_TAGS: Record<Exclude<ArtistKind, 'sonstiges'>, ReadonlySet<string>> = {
  kabarett: new Set(['kabarett', 'comedy', 'stand-up', 'improtheater']),
  buehne: new Set(['theater', 'musical', 'oper', 'operette', 'ballett', 'kindertheater', 'lesung', 'performance-art', 'zirkus']),
  klassik: new Set(['klassik', 'kammermusik', 'chor', 'orgel', 'jazz', 'bigband', 'swing']),
  konzert: new Set([
    'pop', 'rock', 'indie', 'alternative', 'metal', 'punk', 'grunge', 'ska', 'reggae', 'hip-hop', 'rap',
    'r-n-b', 'soul', 'funk', 'disco', 'schlager', 'country', 'folk', 'singer-songwriter', 'latin', 'balkan',
    'weltmusik', 'volksmusik', 'blasmusik', 'heurigenmusik', 'alpine-musik', 'austro-pop', 'dialekt-rap',
    'tamburica', 'electro', 'techno', 'house', 'dj', 'konzert', 'live-musik', 'blues',
  ]),
};

/** Termine, die kein Auftritt sind: wer nur solche hat, ist kein Künstler. */
const NON_PERFORMANCE_TAGS = new Set(['ausstellung', 'messe', 'kino', 'film', 'eishockey', 'fussball', 'turnier', 'stadtführung', 'burgführung', 'museumstour', 'vortrag', 'lecture']);
const NON_PERFORMANCE_CATEGORIES = new Set(['Sport & Bewegung', 'Wissen & Karriere', 'Essen & Trinken', 'Natur & Abenteuer']);

/** Nur Buchstaben und Ziffern, klein, ohne Diakritika: „Graz Tourismus“ und „GrazTourismus“ sind gleich. */
export function compactName(s: string | null | undefined): string {
  return normalizeArtistName(s ?? '').replace(/[^a-z0-9]/g, '');
}

/**
 * Wörter, die ein Haus, eine Reihe oder ein Festival benennen (auf dem
 * normalisierten Namen, als ganzes Wort): „Landestheater Bregenz“,
 * „Klassik in der Krypta“, „Mozart Dinner Concert“, „Backwood Festival“.
 * „Dave Hause“ und „Sondaschule“ bleiben Künstler.
 */
const HOUSE_WORD = /(^|[\s\-:,/(])(\w*theater\w*|\w*buehne|\w*buhne|\w*festival\w*|\w*festspiele|musikverein|\w*haus|\w*halle|\w*kirche|krypta|dinner\w*|lesungen|konzerte|club\w*|kino|museum|galerie|hofreitschule|tourismus|conservatory|kultur\w*|\w*saal)(?=$|[\s\-:,/)])/;

/** Wenn alle Termine an so vielen Orten liegen, ist der Hausname kein Künstler. */
const HOUSE_MAX_VENUES = 3;
/** Ab so vielen Terminen am selben Ort ist auch ein unverdächtiger Name eine Reihe. */
const SERIES_MIN_EVENTS = 10;

/**
 * Haus oder Reihe statt Künstler: der Name ist der Veranstaltungsort (gleich
 * oder dessen Anfang, ab sechs Zeichen, auch nur das erste Wort ab zehn
 * Zeichen: „Brucknerhaus Linz“ in „Brucknerhaus / Großer Saal“); der Name
 * trägt ein Hauswort und alle Termine liegen an höchstens drei Orten; zehn
 * und mehr Termine am selben Ort; oder kein Termin ist ein Auftritt.
 */
export function isHouseOrSeries(name: string, events: DirectoryEventRow[]): boolean {
  const key = compactName(name);
  if (!key) return true;
  const first = compactName(name.split(/[\s\-:,/]/)[0]);
  const venues = new Set<string>();
  let venueMatch = false;
  for (const e of events) {
    const venue = compactName(e.location_name);
    if (!venue) continue;
    venues.add(venue);
    if (venue === key || (key.length >= 6 && venue.startsWith(key))) venueMatch = true;
    if (first.length >= 10 && venue.startsWith(first)) venueMatch = true;
  }
  if (venueMatch) return true;
  if (HOUSE_WORD.test(normalizeArtistName(name).replace(/ü/g, 'ue')) && venues.size <= HOUSE_MAX_VENUES) return true;
  if (events.length >= SERIES_MIN_EVENTS && venues.size === 1) return true;
  const performs = events.some(e => {
    const tags = e.tags ?? [];
    if (tags.some(t => KIND_TAGS.kabarett.has(t) || KIND_TAGS.buehne.has(t) || KIND_TAGS.klassik.has(t) || KIND_TAGS.konzert.has(t))) return true;
    if (tags.some(t => NON_PERFORMANCE_TAGS.has(t))) return false;
    return !NON_PERFORMANCE_CATEGORIES.has(e.category ?? '');
  });
  return !performs;
}

/** Spielart aus den Tags aller Termine; ohne Tag entscheidet die Kategorie. */
export function kindOf(events: DirectoryEventRow[]): { kind: ArtistKind; genre: string | null } {
  const counts = new Map<string, number>();
  const kindCounts: Record<ArtistKind, number> = { konzert: 0, kabarett: 0, buehne: 0, klassik: 0, sonstiges: 0 };
  for (const e of events) {
    for (const t of e.tags ?? []) {
      for (const kind of ['kabarett', 'buehne', 'klassik', 'konzert'] as const) {
        if (KIND_TAGS[kind].has(t)) {
          kindCounts[kind] += 1;
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
    }
  }
  let kind: ArtistKind = 'sonstiges';
  let best = 0;
  for (const k of ['kabarett', 'buehne', 'klassik', 'konzert'] as const) {
    if (kindCounts[k] > best) { best = kindCounts[k]; kind = k; }
  }
  if (kind === 'sonstiges') {
    const cats = events.map(e => e.category ?? '');
    if (cats.some(c => c === 'Musik')) kind = 'konzert';
    else if (cats.some(c => c === 'Kultur & Bühne')) kind = 'buehne';
  }
  let genre: string | null = null;
  let genreCount = 0;
  for (const [t, n] of counts) {
    if (kind !== 'sonstiges' && !KIND_TAGS[kind].has(t)) continue;
    if (n > genreCount) { genreCount = n; genre = t; }
  }
  return { kind, genre };
}

export interface BuildOptions {
  /** Post-Ort zur PLZ (serverseitig aus plz-reference); ohne Angabe bleibt `city` leer. */
  cityOf?: (plz: string) => string | null;
}

function stripEvent(e: DirectoryEventRow, opts: BuildOptions): DirectoryEvent {
  const plz = (e.postal_code ?? '').trim();
  return {
    id: e.id,
    slug: e.slug ?? null,
    title: e.title,
    start_date: e.start_date,
    postal_code: e.postal_code ?? null,
    address: e.address ?? null,
    bundesland: e.bundesland ?? null,
    location_name: e.location_name ?? null,
    city: opts.cityOf && /^\d{4}$/.test(plz) ? opts.cityOf(plz) : null,
    ticket_url: e.ticket_url ?? null,
    is_all_day: e.is_all_day ?? null,
    duration_type: e.duration_type ?? null,
  };
}

/** IDs der Primaries, die für unterdrückte Zeilen nachgeladen werden müssen. */
export function unresolvedPrimaryIds(rows: DirectoryRow[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    const e = r.event;
    if (e && e.publish_status !== 'published' && e.duplicate_of) ids.add(e.duplicate_of);
  }
  return [...ids];
}

/**
 * Zeilen zu Künstlern: sichtbarer Termin je Zeile, Termine je Künstler
 * gesammelt (jedes Event einmal), Häuser und Reihen draußen, Spielart aus
 * den Tags, Termine nach Datum, Künstler nach nächstem Termin, dann Name.
 */
export function buildDirectory(rows: DirectoryRow[], primaries: Map<string, DirectoryEventRow>, opts: BuildOptions = {}): DirectoryArtist[] {
  const byArtist = new Map<string, { name: string; image: string | null; evoLink: string | null; events: Map<string, DirectoryEventRow> }>();
  for (const r of rows) {
    const name = (r.artist_name ?? '').trim();
    if (!r.artist_id || !name || !r.event) continue;
    let event: DirectoryEventRow | null = null;
    if (r.event.publish_status === 'published') event = r.event;
    else if (r.event.duplicate_of) event = primaries.get(r.event.duplicate_of) ?? null;
    if (!event || event.publish_status !== 'published') continue;

    const image = r.artist_image?.trim() || null;
    const entry = byArtist.get(r.artist_id);
    if (!entry) {
      byArtist.set(r.artist_id, { name, image, evoLink: r.evo_link ?? null, events: new Map([[event.id, event]]) });
      continue;
    }
    if (!entry.image && image) entry.image = image;
    if (!entry.evoLink && r.evo_link) entry.evoLink = r.evo_link;
    if (!entry.events.has(event.id)) entry.events.set(event.id, event);
  }

  const out: DirectoryArtist[] = [];
  for (const [id, entry] of byArtist) {
    const events = [...entry.events.values()].sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (isHouseOrSeries(entry.name, events)) continue;
    const { kind, genre } = kindOf(events);
    out.push({
      id,
      name: entry.name,
      slug: artistSlug(entry.name),
      image: entry.image,
      evoLink: entry.evoLink,
      kind,
      genre,
      events: events.slice(0, MAX_EVENTS_PER_ARTIST).map(e => stripEvent(e, opts)),
    });
  }
  return out.sort((a, b) => a.events[0].start_date.localeCompare(b.events[0].start_date) || a.name.localeCompare(b.name, 'de'));
}

export interface ArtistShelf {
  key: 'week' | 'tour' | ArtistKind;
  artists: DirectoryArtist[];
}

/** Künstler mit nächstem Termin bis einschließlich `today + 6` (Wiener Tage). */
export function liveThisWeek(artists: DirectoryArtist[], today: string): DirectoryArtist[] {
  const end = addViennaDays(today, 6);
  return artists.filter(a => toViennaDate(new Date(a.events[0].start_date)) <= end);
}

/** Auf Tour: mindestens drei Termine an mindestens zwei Orten, die meisten zuerst. */
export function onTour(artists: DirectoryArtist[]): DirectoryArtist[] {
  return artists
    .filter(a => a.events.length >= 3 && new Set(a.events.map(e => compactName(e.location_name) || e.postal_code || '')).size >= 2)
    .sort((a, b) => b.events.length - a.events.length || a.events[0].start_date.localeCompare(b.events[0].start_date));
}

/**
 * Regale der Plakatwand: Diese Woche live, Auf Tour, dann je Spielart nach
 * nächstem Termin. Ein Regal braucht SHELF_MIN Künstler, zeigt SHELF_SIZE.
 */
export function planArtistShelves(artists: DirectoryArtist[], today: string): ArtistShelf[] {
  const byDate = (list: DirectoryArtist[]) => [...list].sort((a, b) => a.events[0].start_date.localeCompare(b.events[0].start_date) || a.name.localeCompare(b.name, 'de'));
  const shelves: ArtistShelf[] = [
    { key: 'week', artists: byDate(liveThisWeek(artists, today)) },
    { key: 'tour', artists: onTour(artists) },
    ...(['konzert', 'kabarett', 'buehne', 'klassik'] as const).map(kind => ({ key: kind, artists: byDate(artists.filter(a => a.kind === kind)) })),
  ];
  return shelves
    .filter(s => s.artists.length >= SHELF_MIN)
    .map(s => ({ key: s.key, artists: s.artists.slice(0, SHELF_SIZE) }));
}

/** Anfangsbuchstabe für das Verzeichnis: A bis Z, Ziffern und Rest unter „#“. */
export function letterOf(name: string): string {
  const c = normalizeArtistName(name).replace(/^(the|die|der|das|los|les|le|la)\s+/, '')[0] ?? '';
  return /[a-z]/.test(c) ? c.toUpperCase() : '#';
}

/** Verzeichnis von A bis Z (deutsche Sortierung). */
export function alphabetical(artists: DirectoryArtist[]): DirectoryArtist[] {
  return [...artists].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

/** Namensanfang vor Wortanfang vor Treffer mitten im Wort. */
function rank(name: string, q: string): number {
  if (name.startsWith(q)) return 0;
  if (name.includes(` ${q}`)) return 1;
  return 2;
}

/** Suche im Verzeichnis: Name enthält die Eingabe (ohne Diakritika), Namensanfang zuerst, dann Wortanfang. */
export function searchDirectory(artists: DirectoryArtist[], query: string, limit = 8): DirectoryArtist[] {
  const q = normalizeArtistName(query);
  if (q.length < 2) return [];
  const hits = artists
    .map(a => ({ a, n: normalizeArtistName(a.name) }))
    .filter(x => x.n.includes(q))
    .sort((x, y) => rank(x.n, q) - rank(y.n, q) || x.n.localeCompare(y.n));
  return hits.slice(0, limit).map(x => x.a);
}

/** Verwandte Künstler fürs Blatt: gleiche Spielart, nächste Termine zuerst. */
export function relatedArtists(artists: DirectoryArtist[], artist: DirectoryArtist, count = 4): DirectoryArtist[] {
  const same = artists.filter(a => a.id !== artist.id && a.kind === artist.kind);
  const sameGenre = same.filter(a => artist.genre && a.genre === artist.genre);
  const rest = same.filter(a => !sameGenre.includes(a));
  return [...sameGenre, ...rest].slice(0, count);
}

/** Programmtitel ohne den Künstlernamen davor: „Alex Kristan - Born to be Child“ wird „Born to be Child“. */
export function programTitle(artist: DirectoryArtist, event: DirectoryEvent): string | null {
  const title = (event.title ?? '').trim();
  if (!title) return null;
  if (!normalizeArtistName(title).startsWith(normalizeArtistName(artist.name))) return title;
  const rest = title.slice(artist.name.length).replace(/^[\s\-–:|,]+/, '').trim();
  // „Ernst Molden & Der Nino aus Wien - …“: der Rest beginnt mit einem Partner, der Titel bleibt ganz.
  if (/^(&|\+|und|and|feat\.?|featuring|mit|with|vs\.?)(\s|$)/i.test(rest)) return title;
  return rest || null;
}

/** Slug der Künstlerseite: „Pizzera & Jaus“ wird „pizzera-jaus“, „5/8erl in Ehr’n“ wird „5-8erl-in-ehr-n“. */
export function artistSlug(name: string): string {
  return slugifyPlace(name) || 'kuenstler';
}

/** Der Künstler zu einem Slug; führt mehrere Feed-IDs gleichen Namens zu einem zusammen (Termine vereint, nach Datum). */
export function artistBySlug(artists: DirectoryArtist[], slug: string): DirectoryArtist | null {
  const hits = artists.filter(a => a.slug === slug);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  const seen = new Set<string>();
  const events: DirectoryEvent[] = [];
  for (const a of hits) for (const e of a.events) if (!seen.has(e.id)) { seen.add(e.id); events.push(e); }
  events.sort((a, b) => a.start_date.localeCompare(b.start_date));
  const first = hits.find(a => a.image) ?? hits[0];
  return { ...first, evoLink: hits.find(a => a.evoLink)?.evoLink ?? null, events: events.slice(0, MAX_EVENTS_PER_ARTIST) };
}
