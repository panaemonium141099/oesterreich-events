/**
 * Genauigkeits-Policy je Quelle (fn-25 B3).
 *
 * Viele Adapter liefern Koordinaten, sagen aber nicht, was sie bedeuten:
 * Club- und Museums-Scraper tragen die Koordinate ihres Hauses ein
 * (Venue), Portale und Stadt-Kalender einen Stadt- oder Regionsmittelpunkt.
 * Ohne diese Angabe behandelt der Schreibpfad die Position als „Genauigkeit
 * unbekannt" (Status `unresolved`), Stadt- und Regionsmittelpunkte würden
 * dagegen wie Venue-Pins aussehen.
 *
 * Diese Tabelle ist die eine Stelle, an der das je Quelle festgelegt ist;
 * `applySourceCoordsPolicy` wird in `runScraper` vor dem Sync angewendet und
 * überschreibt NIE eine Angabe, die der Adapter selbst gemacht hat.
 * Quelle und Adapter sind getrennt zu bewerten: „venue" heißt hier „die
 * Koordinate stammt aus der Venue-Konfiguration des Adapters", nicht „die
 * Quelle ist fehlerfrei".
 */
import type { ScrapedEvent } from '@/types/events';
import type { SourceCoordsPrecision } from '@/lib/location/types';

interface SourcePolicy {
  precision: SourceCoordsPrecision;
  /** Ortskontext, den die Quelle per Konstruktion hat (Stadtkalender). */
  city?: string;
}

const POLICIES: Record<string, SourcePolicy> = {
  // Venue-Konfiguration im Adapter: Koordinate = Haus.
  'wien-clubs': { precision: 'venue' },
  'graz-clubs': { precision: 'venue' },
  'innsbruck-clubs': { precision: 'venue' },
  'linz-clubs': { precision: 'venue' },
  'salzburg-clubs': { precision: 'venue' },
  'kleinstadte-clubs': { precision: 'venue' },
  'khm.at': { precision: 'venue' },
  'albertina.at': { precision: 'venue' },
  'mumok.at': { precision: 'venue' },
  'belvedere.at': { precision: 'venue' },
  'nhm-wien.ac.at': { precision: 'venue' },
  'technischesmuseum.at': { precision: 'venue' },
  'leopoldmuseum.org': { precision: 'venue' },
  'ars-electronica.at': { precision: 'venue' },
  stadthalle: { precision: 'venue' },
  posthof: { precision: 'venue' },
  praterwien: { precision: 'venue' },
  // Stadtkalender mit Stadtmittelpunkt für alle Events.
  falter: { precision: 'municipality', city: 'Wien' },
  feverup: { precision: 'municipality', city: 'Wien' },
  graztourismus: { precision: 'municipality', city: 'Graz' },
  // Regionsmittelpunkte: keine Event-Position.
  'tourismus-portale': { precision: 'region' },
};

/** Boudicca-Kollektoren: Koordinaten kommen aus `location.coordinates` (Venue). */
const BOUDICCA_PREFIX = 'boudicca:';

export function applySourceCoordsPolicy(event: ScrapedEvent): ScrapedEvent {
  if (event.coords_precision) return event;
  const hasCoords = typeof event.latitude === 'number' && typeof event.longitude === 'number';
  const policy =
    POLICIES[event.source_name] ??
    (event.source_name.startsWith(BOUDICCA_PREFIX) ? { precision: 'venue' as const } : undefined);
  if (!policy) return event;
  return {
    ...event,
    ...(hasCoords ? { coords_precision: policy.precision } : {}),
    ...(policy.city && !event.city ? { city: policy.city } : {}),
  };
}

/**
 * Platzhalter-Koordinaten erkennen (fn-25, Review §9 „Eventim ohne
 * Venue-Koordinaten … keine Ersatzposition als genauer Eventpin").
 *
 * Der Eventim-Feed liefert für viele Spielstätten ohne eigene Geodaten den
 * Stadtmittelpunkt als „Venue-Koordinate" (Prod 2026-09-14: 48.209/16.37
 * für 92 Wiener Spielstätten in 20 PLZ, 1.855 Termine; Salzburg 14, Graz
 * 14, Klagenfurt 7 Spielstätten). Eine Koordinate, die im selben Abruf für
 * mindestens drei verschiedene Spielstätten steht, die nicht dasselbe Haus
 * sind, ist keine Spielstätten-Koordinate, sondern eine Gebietsangabe: sie
 * wird auf `municipality` abgestuft (Position bleibt als Gebietsangabe, kein
 * Pin). „Nicht dasselbe Haus" heißt: mindestens drei verschiedene Straßen
 * im Adresstext; liefert die Quelle keine Adressen (Feratel: 21 Steyrer
 * Spielstätten auf dem Ortsmittelpunkt), mindestens drei verschiedene
 * Namensstämme. Säle desselben Hauses (Posthof Großer/Kleiner Saal,
 * Stadthalle Halle D/F, Schloss Esterházy Haydnsaal/Empiresaal) teilen sich
 * Koordinate und Straße bzw. Namensstamm und bleiben Venue-Koordinaten.
 * Rein, ohne Netz.
 */
const PLACEHOLDER_MIN_VENUES = 3;
const PLACEHOLDER_MIN_STREETS = 3;
const PLACEHOLDER_MIN_STEMS = 3;

function streetIdentity(address: string | null | undefined): string | null {
  if (!address) return null;
  const first = address.split(',')[0] ?? '';
  const letters = first.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');
  return letters.length >= 4 ? letters : null;
}

/** Namensstamm: gefaltet, ohne Zusatz nach Komma/Klammer/Gedankenstrich, erste zwei Wörter. */
function nameStem(name: string | null | undefined): string | null {
  if (!name) return null;
  const head = name.split(/[,(\u2013\u2014]| - /)[0] ?? '';
  const words = head.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;
  return words.slice(0, 2).join(' ');
}

function venueIdentity(e: ScrapedEvent): string | null {
  if (e.source_venue_id) return e.source_venue_id;
  const name = e.location_name?.toLowerCase().replace(/\s+/g, ' ').trim();
  return name && name.length >= 3 ? name : null;
}

export interface PlaceholderGroup {
  key: string;
  venues: number;
  streets: number;
  stems: number;
  events: number;
}

export function demotePlaceholderCoords(events: ScrapedEvent[]): { events: ScrapedEvent[]; demoted: number; groups: PlaceholderGroup[] } {
  const groups = new Map<string, { venues: Set<string>; streets: Set<string>; stems: Set<string>; idx: number[] }>();
  events.forEach((e, i) => {
    if (e.coords_precision !== 'venue' && e.coords_precision !== 'address') return;
    if (typeof e.latitude !== 'number' || typeof e.longitude !== 'number') return;
    const key = `${e.latitude.toFixed(5)},${e.longitude.toFixed(5)}`;
    const g = groups.get(key) ?? { venues: new Set<string>(), streets: new Set<string>(), stems: new Set<string>(), idx: [] };
    const v = venueIdentity(e);
    const st = streetIdentity(e.address);
    const stem = nameStem(e.location_name);
    if (v) g.venues.add(v);
    if (st) g.streets.add(st);
    if (stem) g.stems.add(stem);
    g.idx.push(i);
    groups.set(key, g);
  });
  const hits: PlaceholderGroup[] = [];
  const demote = new Set<number>();
  for (const [key, g] of groups) {
    if (g.venues.size < PLACEHOLDER_MIN_VENUES) continue;
    const differentHouses = g.streets.size > 0 ? g.streets.size >= PLACEHOLDER_MIN_STREETS : g.stems.size >= PLACEHOLDER_MIN_STEMS;
    if (!differentHouses) continue;
    hits.push({ key, venues: g.venues.size, streets: g.streets.size, stems: g.stems.size, events: g.idx.length });
    for (const i of g.idx) demote.add(i);
  }
  if (demote.size === 0) return { events, demoted: 0, groups: [] };
  return {
    events: events.map((e, i) => (demote.has(i) ? { ...e, coords_precision: 'municipality' as const } : e)),
    demoted: demote.size,
    groups: hits.sort((a, b) => b.events - a.events),
  };
}
