/**
 * Konservative Ortsentscheidung (fn-25, Phase A).
 *
 * Ersetzt im Schreibpfad den GeoNames-Namensabgleich, der Veranstaltungsorte
 * durch gleichnamige Dörfer ersetzt hat ("Haus der Frau" → "Haus im Ennstal",
 * siehe docs/ORTSDATEN-ANALYSE-2026-09-13.md). Regeln:
 *
 *  - Der Ortsname ist der Rohwert der Quelle und wird nie ersetzt.
 *  - Koordinaten kommen nur von der Quelle selbst (mit der vom Adapter
 *    behaupteten Genauigkeit) oder als Gemeinde-/PLZ-Mittelpunkt aus einer
 *    von der Quelle GENANNTEN PLZ bzw. Gemeinde. Nichts wird aus Titel,
 *    Beschreibung oder einzelnen Wörtern des Venue-Namens geraten.
 *  - Eine PLZ wird nie aus einer Koordinate zurückgerechnet.
 *  - Mehrdeutigkeit (mehrere Gemeinden zur PLZ, mehrere gleichnamige
 *    Gemeinden) wird nicht durch Nähe, Größe oder Reihenfolge entschieden.
 *  - Widersprechen sich Quellkoordinate und genannte PLZ deutlich, wird
 *    nichts davon als Position übernommen (`conflict`).
 *
 * Rein (kein I/O außer der beim ersten Aufruf geladenen Gemeinde-Registry),
 * deshalb ohne Datenbank testbar.
 */
import { createHash } from 'crypto';
import { bundeslandToId } from '@/lib/bundeslaender';
import {
  gemeindenByName,
  gemeindenByPlz,
  isKnownAustrianPlz,
  normalizeGemeindeName,
  plzCentroid,
  type GemeindeRef,
} from './gemeinde-index';
import {
  LOCATION_RESOLUTION_VERSION,
  type AllowedOutputs,
  type LocationDecision,
  type LocationPrecision,
  type LocationStatus,
  type Provenance,
  type SourceCoordsPrecision,
} from './types';

export interface LocationInput {
  title?: string | null;
  location_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  /** Von der Quelle ausdrücklich genannter Ort (z. B. Eventim `eventCity`). */
  city?: string | null;
  bundesland?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Vom Adapter behauptete Genauigkeit der gelieferten Koordinaten. */
  coords_precision?: SourceCoordsPrecision | null;
  source_venue_id?: string | null;
  /** Bestehende Event-ID (nur zum Laden eventbezogener Korrekturen; geht
   *  nicht in den Eingabehash ein). */
  event_id?: string | null;
  /** Quelle (nur für den Schlüssel bestätigter Namens-Zuordnungen, siehe
   *  `venue-key.ts`; nicht im Eingabehash). */
  source_name?: string | null;
}

// Österreich-Bounding-Box wie in admission.ts / score-event.ts.
const AT_BOX = { latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 };
// Grober Europa-Rahmen für Nicht-AT-Events.
const EU_BOX = { latMin: 35, latMax: 72, lngMin: -25, lngMax: 45 };
/** Ab dieser Distanz zwischen Quellkoordinate und genannter PLZ-Gemeinde
 *  gilt der Datensatz als widersprüchlich. */
const CONFLICT_KM = 30;

const ONLINE_PATTERN = /^(online|onlineevent|online-event|online event|virtuell|virtual|webinar|livestream|zoom)\b/i;

function hasText(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inBox(lat: number, lng: number, b: typeof AT_BOX): boolean {
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

/** Hausnummer im Adresstext: „Straße 12", „Platz 3a", „Ritzenried 107". */
export function hasHouseNumber(address: string | null | undefined): boolean {
  if (!hasText(address)) return false;
  return /[A-Za-zÄÖÜäöüß.)]\s+\d{1,4}[a-zA-Z]?(\s*[-/]\s*\d{1,4}[a-zA-Z]?)?(?=[\s,;]|$)/.test(address);
}

/**
 * Ausdrücklich im Adresstext genannte österreichische PLZ. Genau ein
 * bekannter Wert muss vorkommen; „Straße 1010" wird durch die
 * Bekanntheitsprüfung nicht ausgeschlossen, deshalb zusätzlich: die Zahl
 * darf nicht direkt hinter einem Straßenwort stehen, dem noch ein Wort mit
 * Buchstaben folgt (Hausnummern stehen am Ende eines Adressteils, PLZ vor
 * dem Ortsnamen oder am Teilende).
 */
export function extractPlzFromAddress(address: string | null | undefined): string | null {
  if (!hasText(address)) return null;
  const found = new Set<string>();
  const re = /(?:^|[\s,;(])(\d{4})(?=[\s,;)]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(address)) !== null) {
    if (isKnownAustrianPlz(m[1])) found.add(m[1]);
  }
  if (found.size !== 1) return null;
  return [...found][0];
}

/** „Flohmarkt in 1230 Wien" — Präposition „in", PLZ, großgeschriebener Ort. */
export function extractPlzFromTitle(title: string | null | undefined): string | null {
  if (!hasText(title)) return null;
  const m = /\bin\s+(\d{4})\s+[A-ZÄÖÜ]/.exec(title);
  if (!m) return null;
  return isKnownAustrianPlz(m[1]) ? m[1] : null;
}

/** Ortsname hinter einer PLZ im Adresstext („4020 Linz", „7083 Purbach am See"). */
export function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!hasText(address)) return null;
  const m = /\b\d{4}\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]*(?:\s+(?:am|an|im|in|bei|ob|der|dem|und)\s+[A-ZÄÖÜ]?[A-Za-zÄÖÜäöüß.\-]*|\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]*)*)/.exec(address);
  if (m) return m[1].trim().replace(/[,;]+$/, '');
  // Letzter Kommateil ohne Ziffern („Rennweg 2, Innsbruck").
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && last && !/\d/.test(last) && last.length >= 3) return last;
  return null;
}

function uniqueInBundesland(refs: GemeindeRef[], bl: string | null): GemeindeRef | null {
  const pool = bl ? refs.filter(r => r.bundesland === bl) : refs;
  return pool.length === 1 ? pool[0] : null;
}

/** Koordinaten auf 6 Nachkommastellen (~0,1 m): PostgREST liefert double
 *  precision mit weniger Stellen zurück als der Adapter geliefert hat; ohne
 *  Rundung wäre derselbe Quellenstand nach dem Rücklesen ein „anderer". */
function round6(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
}

/**
 * Ländercode der Quelle. Adapter liefern teils Namen statt Codes (Deskline:
 * „ÖSTERREICH", „DEUTSCHLAND"); ohne Abbildung galt jedes Feratel-Event als
 * Ausland, ohne Gemeinde- und PLZ-Logik, und fiel aus dem Länderfilter der
 * API (9.432 Events, Prod 2026-09-14). Unbekannte Namen bleiben erhalten
 * (nicht AT), leere Angabe heißt AT.
 */
const COUNTRY_NAMES: Record<string, string> = {
  AT: 'AT', A: 'AT', AUT: 'AT', OESTERREICH: 'AT', OSTERREICH: 'AT', AUSTRIA: 'AT', OESTERR: 'AT',
  DE: 'DE', D: 'DE', DEU: 'DE', DEUTSCHLAND: 'DE', GERMANY: 'DE',
  CH: 'CH', CHE: 'CH', SCHWEIZ: 'CH', SWITZERLAND: 'CH', SUISSE: 'CH', SVIZZERA: 'CH',
  IT: 'IT', ITA: 'IT', ITALIEN: 'IT', ITALY: 'IT', ITALIA: 'IT',
  HU: 'HU', HUN: 'HU', UNGARN: 'HU', HUNGARY: 'HU',
  SI: 'SI', SVN: 'SI', SLOWENIEN: 'SI', SLOVENIA: 'SI',
  CZ: 'CZ', CZE: 'CZ', TSCHECHIEN: 'CZ', CZECHIA: 'CZ',
  SK: 'SK', SVK: 'SK', SLOWAKEI: 'SK', SLOVAKIA: 'SK',
  LI: 'LI', LIE: 'LI', LIECHTENSTEIN: 'LI',
};

export function normalizeCountryCode(raw: string | null | undefined): string {
  if (!hasText(raw)) return 'AT';
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .replace(/[^A-Z]/g, '');
  if (!key) return 'AT';
  return COUNTRY_NAMES[key] ?? (key.length === 2 ? key : raw.trim().toUpperCase());
}

/** Kanonische Form der Kontextangaben für den Hash: Sync (Adapterform
 *  „Oberösterreich", „ÖSTERREICH") und Backfill (Zeile: „oberoesterreich")
 *  müssen denselben Quellenstand als denselben erkennen. */
function hashContext(input: LocationInput): { b: string | null; co: string | null } {
  return {
    b: bundeslandToId(input.bundesland) ?? (hasText(input.bundesland) ? input.bundesland.trim().toLowerCase() : null),
    co: hasText(input.country) ? normalizeCountryCode(input.country) : null,
  };
}

function inputHash(input: LocationInput): string {
  const ctx = hashContext(input);
  const payload = JSON.stringify({
    t: input.title ?? null,
    l: input.location_name ?? null,
    a: input.address ?? null,
    p: input.postal_code ?? null,
    c: input.city ?? null,
    b: ctx.b,
    co: ctx.co,
    la: round6(input.latitude),
    lo: round6(input.longitude),
    pr: input.coords_precision ?? null,
    v: input.source_venue_id ?? null,
  });
  return createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

/**
 * Hash nur der ORTSANGABEN der Quelle (ohne Titel). Eine manuelle Korrektur
 * bezieht sich auf diesen Stand: Liefert die Quelle später andere
 * Ortsangaben (Verlegung, anderer Saal, neue Venue-Kennung), passt die
 * Korrektur nicht mehr und die Entscheidung wird neu getroffen (Review §7).
 */
export function locationBasisHash(input: LocationInput): string {
  const payload = JSON.stringify({
    l: input.location_name ?? null,
    a: input.address ?? null,
    p: input.postal_code ?? null,
    c: input.city ?? null,
    co: hashContext(input).co,
    la: round6(input.latitude),
    lo: round6(input.longitude),
    pr: input.coords_precision ?? null,
    v: input.source_venue_id ?? null,
  });
  return createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

const NO_OUTPUT: AllowedOutputs = { pin: false, route: false, distance: false, municipality_page: false };

function allowedFor(status: LocationStatus, hasCoords: boolean, routable: boolean, hasGemeinde: boolean): AllowedOutputs {
  const precise = hasCoords && (status === 'venue_confirmed' || status === 'address_confirmed');
  return {
    pin: precise,
    route: precise && (routable || status === 'venue_confirmed'),
    distance: precise,
    municipality_page:
      hasGemeinde && (status === 'venue_confirmed' || status === 'address_confirmed' || status === 'municipality_only'),
  };
}

/**
 * Trifft die Ortsentscheidung für ein Scraper-Event. Kein Zugriff auf
 * bestehende Zeilen: was mit Altkoordinaten passiert, entscheidet der
 * Schreibpfad und vermerkt es in der gespeicherten Entscheidung.
 */
export function resolveConservativeLocation(input: LocationInput, now: Date = new Date()): LocationDecision {
  const reasons: string[] = [];
  const evidence: string[] = [];
  const rejected: string[] = [];
  const provenance: LocationDecision['provenance'] = {};

  const country = normalizeCountryCode(input.country);
  const isAT = country === 'AT';
  provenance.country = hasText(input.country) ? 'source' : 'default';

  const locationName = hasText(input.location_name) ? input.location_name.trim() : null;
  if (locationName) provenance.location_name = 'source';

  const declaredBl = bundeslandToId(input.bundesland) ?? null;
  if (declaredBl) evidence.push(`bundesland:source:${declaredBl}`);

  const base = {
    version: LOCATION_RESOLUTION_VERSION,
    location_name: locationName,
    country,
    resolved_at: now.toISOString(),
    input_hash: inputHash(input),
    reasons,
    evidence,
    rejected,
    provenance,
  };

  // ── Online-Events ──────────────────────────────────────────────────
  if (locationName && ONLINE_PATTERN.test(locationName)) {
    reasons.push('online_location');
    return {
      ...base,
      status: 'online',
      precision: 'unknown',
      postal_code: null,
      gemeinde: null,
      latitude: null,
      longitude: null,
      geocoding_confidence: null,
      geocoding_source: null,
      allowed: { ...NO_OUTPUT },
    };
  }

  // ── Genannte PLZ (nur AT) ──────────────────────────────────────────
  let plz: string | null = null;
  if (isAT) {
    const src = hasText(input.postal_code) ? input.postal_code.trim() : null;
    if (src && /^\d{4}$/.test(src)) {
      if (isKnownAustrianPlz(src)) {
        plz = src;
        provenance.postal_code = 'source';
        evidence.push(`plz:source:${src}`);
      } else {
        rejected.push(`postal_code:${src}:unknown_at_plz`);
      }
    } else if (src) {
      rejected.push(`postal_code:${src}:not_4_digits`);
    }
    if (!plz) {
      const fromAddress = extractPlzFromAddress(input.address);
      if (fromAddress) {
        plz = fromAddress;
        provenance.postal_code = 'address_text';
        evidence.push(`plz:address_text:${fromAddress}`);
      }
    }
    if (!plz) {
      const fromTitle = extractPlzFromTitle(input.title);
      if (fromTitle) {
        plz = fromTitle;
        provenance.postal_code = 'title_text';
        evidence.push(`plz:title_text:${fromTitle}`);
      }
    }
  } else if (hasText(input.postal_code)) {
    // Ausländische PLZ bleibt Quellangabe, aber ohne österreichische Ableitungen.
    rejected.push(`postal_code:${input.postal_code.trim()}:foreign_country_${country}`);
  }

  // ── Genannter Ort (Quellfeld oder Adresstext) ─────────────────────
  const cityText = hasText(input.city) ? input.city.trim() : extractCityFromAddress(input.address);

  // ── Gemeinde belegen ───────────────────────────────────────────────
  let gemeinde: GemeindeRef | null = null;
  let gemeindeProvenance: Provenance | null = null;
  let plzAmbiguous = false;
  if (isAT && plz) {
    const refs = gemeindenByPlz(plz);
    if (refs.length === 1) {
      gemeinde = refs[0];
      gemeindeProvenance = 'derived:plz';
    } else if (refs.length > 1) {
      // Mehrere Gemeinden teilen die PLZ (154 von 1.719 in der Registry,
      // z. B. 2413 Berg/NÖ und Edelstal/Bgld). Auflösung nur über einen
      // genannten Ortsnamen oder das deklarierte Bundesland, nie über
      // Reihenfolge oder Nähe.
      const key = cityText ? normalizeGemeindeName(cityText) : null;
      const byName = key ? refs.find(r => normalizeGemeindeName(r.name) === key) : undefined;
      const byBl = declaredBl ? refs.filter(r => r.bundesland === declaredBl) : [];
      if (byName) {
        gemeinde = byName;
        gemeindeProvenance = 'registry';
      } else if (byBl.length === 1) {
        gemeinde = byBl[0];
        gemeindeProvenance = 'derived:plz';
        evidence.push(`gemeinde:plz+bundesland:${byBl[0].name}`);
      } else {
        plzAmbiguous = true;
        reasons.push('plz_covers_multiple_gemeinden');
      }
    }
  }
  if (isAT && !gemeinde && cityText) {
    const hit = uniqueInBundesland(gemeindenByName(cityText), declaredBl);
    if (hit) {
      // Ohne PLZ nur mit Bundesland-Sperre; ohne Bundesland nur, wenn der
      // Name österreichweit eindeutig ist.
      gemeinde = hit;
      gemeindeProvenance = 'registry';
      evidence.push(`gemeinde:city_text:${hit.name}`);
    } else if (gemeindenByName(cityText).length > 1) {
      reasons.push('city_name_ambiguous');
    }
  }
  if (isAT && !gemeinde && !plz && locationName && declaredBl) {
    // Der Ortsname IST ein Gemeindename (Feratel „Galtür", Mozarteum
    // „Salzburg"): nur im deklarierten Bundesland, nur eindeutig, und der
    // Name wird dabei nicht verändert.
    const hit = uniqueInBundesland(gemeindenByName(locationName), declaredBl);
    if (hit) {
      gemeinde = hit;
      gemeindeProvenance = 'registry';
      reasons.push('location_name_is_gemeinde_name');
      evidence.push(`gemeinde:location_name:${hit.name}`);
    }
  }
  if (gemeinde) {
    provenance.gemeinde = gemeindeProvenance ?? 'registry';
    if (!plz && gemeindeProvenance === 'registry') {
      // PLZ der belegten Gemeinde übernehmen: Herkunft bleibt sichtbar.
      plz = gemeinde.plz;
      provenance.postal_code = 'registry';
    }
  }

  // Anzeigename: der Rohwert der Quelle. Nennt die Quelle keinen
  // Veranstaltungsort, zeigt die Zeile die belegte Gemeinde bzw. den
  // genannten Ort; `location_name_raw` bleibt dabei leer, die Herkunft
  // steht im Protokoll.
  if (!locationName) {
    if (gemeinde) {
      base.location_name = gemeinde.name;
      provenance.location_name = 'registry';
    } else if (cityText) {
      base.location_name = cityText;
      provenance.location_name = hasText(input.city) ? 'source' : 'address_text';
    }
  }

  // ── Quellkoordinaten prüfen ────────────────────────────────────────
  let lat: number | null = null;
  let lng: number | null = null;
  let precisionClaim: SourceCoordsPrecision | null = null;
  const srcLat = typeof input.latitude === 'number' && Number.isFinite(input.latitude) ? input.latitude : null;
  const srcLng = typeof input.longitude === 'number' && Number.isFinite(input.longitude) ? input.longitude : null;
  if (srcLat != null && srcLng != null && !(srcLat === 0 && srcLng === 0)) {
    const box = isAT ? AT_BOX : EU_BOX;
    if (!inBox(srcLat, srcLng, box)) {
      rejected.push(`coords:${srcLat.toFixed(4)},${srcLng.toFixed(4)}:outside_${isAT ? 'at' : 'eu'}_box`);
    } else {
      lat = srcLat;
      lng = srcLng;
      precisionClaim = input.coords_precision ?? 'unknown';
      provenance.latitude = 'source';
      evidence.push(`coords:source:${precisionClaim}`);
    }
  }

  // Region-Mittelpunkte sind keine Event-Position.
  if (lat != null && precisionClaim === 'region') {
    rejected.push('coords:region_centroid_not_a_position');
    lat = null;
    lng = null;
    delete provenance.latitude;
  }

  // ── Widerspruch Quellkoordinate ↔ genannte PLZ ────────────────────
  if (lat != null && lng != null && isAT && plz) {
    const centroid = plzCentroid(plz, cityText ?? locationName);
    if (centroid && !centroid.ambiguous) {
      const km = haversineKm(lat, lng, centroid.lat, centroid.lng);
      if (km > CONFLICT_KM) {
        reasons.push(`coords_vs_plz_conflict:${Math.round(km)}km`);
        rejected.push(`coords:${lat.toFixed(4)},${lng.toFixed(4)}:${Math.round(km)}km_from_plz_${plz}`);
        return {
          ...base,
          status: 'conflict',
          precision: 'unknown',
          postal_code: plz,
          gemeinde: gemeinde ? { name: gemeinde.name, plz: gemeinde.plz, bundesland: gemeinde.bundesland, bezirk: gemeinde.bezirk } : null,
          latitude: null,
          longitude: null,
          geocoding_confidence: null,
          geocoding_source: null,
          allowed: { ...NO_OUTPUT },
        };
      }
    }
  }

  const routable = hasHouseNumber(input.address);
  const gemeindeOut = gemeinde
    ? { name: gemeinde.name, plz: gemeinde.plz, bundesland: gemeinde.bundesland, bezirk: gemeinde.bezirk }
    : null;

  // ── Quellkoordinate übernehmen ─────────────────────────────────────
  if (lat != null && lng != null) {
    let status: LocationStatus;
    let precision: LocationPrecision;
    switch (precisionClaim) {
      case 'venue':
        status = hasText(input.source_venue_id) ? 'venue_confirmed' : 'address_confirmed';
        precision = 'building';
        break;
      case 'address':
        status = 'address_confirmed';
        precision = routable ? 'building' : 'street';
        break;
      case 'municipality':
        status = 'municipality_only';
        precision = 'municipality';
        break;
      case 'postcode':
        status = 'municipality_only';
        precision = 'postcode';
        break;
      default:
        // Alte Adapter ohne Genauigkeitsangabe: Position speichern, aber
        // nicht als bestätigt behandeln.
        status = 'unresolved';
        precision = 'unknown';
        reasons.push('source_coords_precision_unknown');
    }
    if (hasText(input.source_venue_id)) evidence.push(`source_venue_id:${input.source_venue_id.trim()}`);
    return {
      ...base,
      status,
      precision,
      postal_code: plz,
      gemeinde: gemeindeOut,
      latitude: lat,
      longitude: lng,
      // Ein vom Adapter als Gemeinde-/PLZ-Mittelpunkt gekennzeichneter Punkt
      // bleibt auch im Label eine Gebietsangabe.
      geocoding_confidence:
        precisionClaim === 'municipality' || precisionClaim === 'postcode' ? 'gemeinde-centroid' : 'scraper',
      geocoding_source: 'scraper',
      // Ein Gelände, Treffpunkt oder Wanderstart hat keine Hausnummer; eine
      // Venue-Koordinate der Quelle ist trotzdem ein belegter Zielpunkt.
      allowed: allowedFor(status, true, routable || precisionClaim === 'venue', !!gemeindeOut || !!plz),
    };
  }

  // ── Kein Quellpunkt: Gemeinde-/PLZ-Mittelpunkt als Gebietsangabe ──
  if (isAT && gemeinde) {
    const namedBySource =
      gemeindeProvenance === 'registry' ||
      (cityText ? normalizeGemeindeName(cityText) === normalizeGemeindeName(gemeinde.name) : false);
    reasons.push(namedBySource ? 'gemeinde_centroid_from_named_gemeinde' : 'gemeinde_centroid_from_plz');
    provenance.latitude = 'derived:plz';
    return {
      ...base,
      status: 'municipality_only',
      precision: namedBySource ? 'municipality' : 'postcode',
      postal_code: plz,
      gemeinde: gemeindeOut,
      latitude: gemeinde.lat,
      longitude: gemeinde.lng,
      geocoding_confidence: 'gemeinde-centroid',
      geocoding_source: 'gemeinde-registry',
      allowed: allowedFor('municipality_only', true, false, true),
    };
  }
  if (isAT && plz && !plzAmbiguous) {
    const centroid = plzCentroid(plz);
    if (centroid && !centroid.ambiguous) {
      reasons.push('plz_centroid_from_table');
      provenance.latitude = 'derived:plz';
      return {
        ...base,
        status: 'municipality_only',
        precision: 'postcode',
        postal_code: plz,
        gemeinde: null,
        latitude: centroid.lat,
        longitude: centroid.lng,
        geocoding_confidence: 'gemeinde-centroid',
        geocoding_source: 'plz-table',
        allowed: allowedFor('municipality_only', true, false, true),
      };
    }
  }

  // ── Nichts Belastbares ─────────────────────────────────────────────
  if (plz) {
    reasons.push('plz_known_but_no_unique_position');
    return {
      ...base,
      status: 'municipality_only',
      precision: 'postcode',
      postal_code: plz,
      gemeinde: null,
      latitude: null,
      longitude: null,
      geocoding_confidence: null,
      geocoding_source: null,
      allowed: allowedFor('municipality_only', false, false, true),
    };
  }
  if (declaredBl) {
    reasons.push('only_bundesland_known');
    return {
      ...base,
      status: 'region_only',
      precision: 'region',
      postal_code: null,
      gemeinde: null,
      latitude: null,
      longitude: null,
      geocoding_confidence: null,
      geocoding_source: null,
      allowed: { ...NO_OUTPUT },
    };
  }
  reasons.push(locationName || hasText(input.address) ? 'no_position_evidence' : 'no_location_evidence');
  return {
    ...base,
    status: 'unresolved',
    precision: 'unknown',
    postal_code: null,
    gemeinde: null,
    latitude: null,
    longitude: null,
    geocoding_confidence: null,
    geocoding_source: null,
    allowed: { ...NO_OUTPUT },
  };
}
