/**
 * Gemeinsame Vorarbeit von Freigabe und Vorschau eines Inserats.
 *
 * Die Freigabe-Route (PATCH /api/admin/event-submissions/[id]) und die
 * Vorschau-Route (POST …/[id]/preview) müssen dieselben Korrekturen
 * annehmen und dieselben Koordinaten finden — sonst zeigt die Vorschau
 * ein anderes Event als das, das die Freigabe anlegt. Deshalb steht beides
 * hier genau einmal.
 */

import type { ApprovableSubmission } from './approve';
import { clean, cleanMultiline, cleanUrl, MAX_DESCRIPTION_LENGTH } from './submission';
import { geocodeLocation } from '@/lib/geocoding';
import { buildGeocodeCandidates, precisionOfCandidate } from './geocode-query';

/** Felder, die der Admin vor der Freigabe korrigieren darf. Bewusst ohne
 *  Datum: eine Terminänderung ist keine Korrektur, sondern ein anderes
 *  Event — das gehört zurück an den Inserenten. */
const EDITABLE_TEXT: Array<[key: string, column: string, max: number]> = [
  ['title', 'title', 200],
  ['category', 'category', 60],
  ['locationName', 'location_name', 200],
  ['address', 'address', 300],
  ['postalCode', 'postal_code', 10],
  ['city', 'city', 200],
  ['bundesland', 'bundesland', 40],
  ['priceText', 'price_text', 200],
  ['organizer', 'organizer', 200],
];

const EDITABLE_URL: Array<[key: string, column: string]> = [
  ['ticketUrl', 'ticket_url'],
  ['imageUrl', 'image_url'],
  ['eventUrl', 'event_url'],
];

/** Zieht die erlaubten Korrekturen aus dem Body. Unbekannte Schlüssel
 *  werden ignoriert — der Body darf nicht bestimmen, welche Spalten
 *  geschrieben werden. */
export function extractEdits(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const edits: Record<string, string | null> = {};

  // Die Beschreibung ist der einzige mehrzeilige Text: ihre Absaetze sind
  // Inhalt (Line-up, Uhrzeiten, Preise) und muessen die Korrektur im Admin
  // ueberleben. `clean` wuerde sie zwar nicht zerstoeren, aber auch nicht
  // normalisieren — cleanMultiline macht beides an einer Stelle.
  if ('description' in input) {
    edits.description = cleanMultiline(input.description, MAX_DESCRIPTION_LENGTH);
  }

  for (const [key, column, max] of EDITABLE_TEXT) {
    if (key in input) edits[column] = clean(input[key], max);
  }
  for (const [key, column] of EDITABLE_URL) {
    if (key in input) edits[column] = cleanUrl(input[key]);
  }
  return edits;
}

export interface ResolvedCoordinates {
  latitude: number | null;
  longitude: number | null;
  /** Der Kandidat, auf den der Geocoder getroffen hat (null ohne Treffer). */
  geocodedFrom: string | null;
  coordsPrecision: 'address' | 'venue' | 'municipality' | null;
  /** Alle probierten Kandidaten, von genau nach grob. */
  tried: string[];
}

/**
 * Koordinaten des Inserats aufloesen. Das ist KEINE Kuer: /api/events
 * filtert `.not('latitude','is',null)` und die MV event_map_points verlangt
 * lat/lng. Ein freigegebenes Inserat ohne Koordinaten ist deshalb nicht
 * bloss ohne Kartenpin, sondern in Liste, Karte UND Suche unsichtbar.
 * Genau so verschwand am 2026-09-07 ein bereits veroeffentlichtes Event.
 *
 * Die Kandidaten kommen aus buildGeocodeCandidates und gehen von genau
 * nach grob (Adresse mit Ort -> PLZ+Ort -> Venue+Ort -> Ort). Frueher
 * stand hier eine naiv zusammengeklebte Zeichenkette
 * ("Strasse, PLZ, Venue"), auf die Nominatim nichts lieferte.
 *
 * Der Geocoder cacht in Supabase: Vorschau und anschliessende Freigabe
 * kosten zusammen nur eine Nominatim-Anfrage.
 */
export async function resolveSubmissionCoordinates(
  merged: ApprovableSubmission,
): Promise<ResolvedCoordinates> {
  const tried = buildGeocodeCandidates(merged);
  for (const candidate of tried) {
    try {
      const geo = await geocodeLocation(candidate);
      if (geo) {
        return {
          latitude: geo.latitude,
          longitude: geo.longitude,
          geocodedFrom: candidate,
          coordsPrecision: precisionOfCandidate(candidate, merged),
          tried,
        };
      }
    } catch (err) {
      console.error('[admin/event-submissions] geocoding failed:', candidate, err);
    }
  }
  return { latitude: null, longitude: null, geocodedFrom: null, coordsPrecision: null, tried };
}
