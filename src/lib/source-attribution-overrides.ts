/**
 * Regionale Quellen-Attribution-Overrides (2026-08-27).
 *
 * Hintergrund: Der Feratel-Deskline-Feed traegt als technisches
 * Quellsystem "feratel-deskline" — die INHALTE erfassen und pflegen
 * aber die jeweiligen Tourismusverbaende. Der Oetztal Tourismus hat
 * (Schreiben R. Gruener, 26.08.2026) eine deutliche Quellenangabe samt
 * Verlinkung auf seine Destinationswebsite als Bedingung der weiteren
 * Nutzung formuliert. Dieses Mapping stellt die Anzeige fuer die
 * betroffene Region auf den tatsaechlichen Rechteinhaber um.
 *
 * Display-Level statt DB-Update: der stuendliche sync-feratel-Cron
 * wuerde ein UPDATE auf events.source_name beim naechsten Upsert
 * wieder ueberschreiben.
 *
 * Erweiterbar: weitere Verbaende einfach als zusaetzliche Eintraege
 * in REGION_OVERRIDES ergaenzen.
 */

export interface SourceAttribution {
  name: string | null;
  url: string | null;
}

interface RegionOverride {
  /** Greift nur fuer diese technische Quelle. */
  sourceName: string;
  /** PLZ der Gemeinden des Verbandsgebiets. */
  postalCodes: Set<string>;
  /** Fallback-Erkennung ueber Ortsnamen (Feratel liefert oft nur location_name). */
  locationPattern: RegExp;
  attribution: { name: string; url: string };
  /** Orts-genauere Destinationsseiten INNERHALB des Verbandsgebiets —
   *  erste passende Regel gewinnt, sonst attribution.url. */
  subSites?: Array<{ pattern: RegExp; postalCodes?: Set<string>; url: string }>;
}

/** Oetztal Tourismus: Haiming bis Obergurgl (inkl. Soelden, Vent, Gurgl). */
const REGION_OVERRIDES: RegionOverride[] = [
  {
    sourceName: 'feratel-deskline',
    postalCodes: new Set(['6425', '6430', '6432', '6433', '6441', '6444', '6450', '6456', '6458']),
    locationPattern: /ötztal|oetztal|sölden|soelden|obergurgl|hochgurgl|längenfeld|laengenfeld|umhausen|sautens|niederthai|\bvent\b|\boetz\b|\bötz\b|haiming/i,
    attribution: { name: 'Ötztal Tourismus', url: 'https://www.oetztal.com' },
    // Der Verband nennt drei Destinationsseiten (Schreiben 26.08.2026):
    // oetztal.com, soelden.com, gurgl.com. gurgl bewusst mit
    // Wortgrenze — "Gurgltal" (bei Imst!) darf NICHT matchen.
    subSites: [
      { pattern: /obergurgl|hochgurgl|gurgl/i, url: 'https://www.gurgl.com' },
      { pattern: /sölden|soelden|vent/i, postalCodes: new Set(['6450', '6458']), url: 'https://www.soelden.com' },
    ],
  },
];

export function resolveSourceAttribution(event: {
  source_name?: string | null;
  source_url?: string | null;
  postal_code?: string | null;
  location_name?: string | null;
  address?: string | null;
}): SourceAttribution {
  for (const o of REGION_OVERRIDES) {
    if (event.source_name !== o.sourceName) continue;
    const plzHit = event.postal_code ? o.postalCodes.has(event.postal_code) : false;
    const haystack = `${event.location_name ?? ''} ${event.address ?? ''}`;
    if (plzHit || o.locationPattern.test(haystack)) {
      for (const sub of o.subSites ?? []) {
        const subPlz = sub.postalCodes && event.postal_code ? sub.postalCodes.has(event.postal_code) : false;
        if (subPlz || sub.pattern.test(haystack)) {
          return { name: o.attribution.name, url: sub.url };
        }
      }
      return { name: o.attribution.name, url: o.attribution.url };
    }
  }
  return { name: event.source_name ?? null, url: event.source_url ?? null };
}
