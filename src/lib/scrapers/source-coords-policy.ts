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
