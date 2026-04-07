// src/lib/pipeline/venue-matcher.ts
import { createClient } from '@supabase/supabase-js';
import { jaroWinkler } from '@/lib/dedup/jaro-winkler';
import {
  normalizeVenueName,
  normalizeVenueNameCompact,
  extractHost,
  haversineDistance,
} from './normalize-venue';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface VenueMatchResult {
  venueId: string | null;
  confidence: number;
  stage: 0 | 1 | 2 | 3 | null; // null = no match
}

interface VenueRow {
  id: string;
  name: string;
  name_normalized: string | null;
  display_name: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  website_host: string | null;
}

interface AliasRow {
  venue_id: string;
  alias_normalized: string;
  confidence: number;
}

// Cache for venues and aliases (loaded once per pipeline run)
let venueCache: VenueRow[] | null = null;
let aliasCache: Map<string, AliasRow[]> | null = null;

export async function loadVenueCache(): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Load all venues
  const { data: venues } = await supabase
    .from('venues')
    .select(
      'id, name, name_normalized, display_name, city, postal_code, latitude, longitude, website, website_host',
    );
  venueCache = (venues ?? []) as VenueRow[];

  // Load all aliases, grouped by normalized name
  const { data: aliases } = await supabase
    .from('venue_aliases')
    .select('venue_id, alias_normalized, confidence');

  aliasCache = new Map();
  for (const alias of (aliases ?? []) as AliasRow[]) {
    const existing = aliasCache.get(alias.alias_normalized) ?? [];
    existing.push(alias);
    aliasCache.set(alias.alias_normalized, existing);
  }

  console.log(
    `[VenueMatcher] Loaded ${venueCache.length} venues, ${aliasCache.size} unique aliases`,
  );
}

export function clearVenueCache(): void {
  venueCache = null;
  aliasCache = null;
}

/**
 * Match an event's location to a venue using 3-stage matching.
 *
 * Stage 1: Hard match (confidence >= 0.95) — exact alias + city, exact URL host
 * Stage 2: Soft match (confidence 0.70-0.94) — fuzzy name + PLZ, proximity + name
 * Stage 3: Uncertain (confidence < 0.70) — NOT automatically mapped
 */
export async function matchVenue(event: {
  location_name?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_url?: string | null;
  ticket_url?: string | null;
}): Promise<VenueMatchResult> {
  if (!venueCache || !aliasCache) await loadVenueCache();
  if (!event.location_name && !event.source_url) {
    return { venueId: null, confidence: 0, stage: null };
  }

  const normalizedName = event.location_name
    ? normalizeVenueName(event.location_name)
    : null;
  const compactName = event.location_name
    ? normalizeVenueNameCompact(event.location_name)
    : null;

  // === STAGE 1: Hard matches ===

  // 1a. Exact alias match + same city/PLZ
  if (normalizedName && aliasCache) {
    const aliasMatches = aliasCache.get(normalizedName) ?? [];
    // Also try compact name
    const compactMatches = compactName
      ? (aliasCache.get(compactName) ?? [])
      : [];
    const allMatches = [...aliasMatches, ...compactMatches];

    for (const alias of allMatches) {
      const venue = venueCache!.find((v) => v.id === alias.venue_id);
      if (!venue) continue;

      // Verify city or PLZ match for disambiguation
      const cityMatch =
        event.city &&
        venue.city &&
        event.city.toLowerCase() === venue.city.toLowerCase();
      const plzMatch =
        event.postal_code &&
        venue.postal_code &&
        event.postal_code === venue.postal_code;

      if (cityMatch || plzMatch) {
        let confidence = 0.95 * alias.confidence;
        // Geo bonus/penalty
        confidence = applyGeoAdjustment(confidence, event, venue);
        if (confidence >= 0.95) {
          return { venueId: venue.id, confidence, stage: 1 };
        }
      }
    }

    // 1b. Exact name + same city (no alias needed)
    if (normalizedName) {
      for (const venue of venueCache!) {
        const venueNorm =
          venue.name_normalized?.toLowerCase() ??
          normalizeVenueName(venue.name);
        if (venueNorm === normalizedName || venueNorm === compactName) {
          const cityMatch =
            event.city &&
            venue.city &&
            event.city.toLowerCase() === venue.city.toLowerCase();
          if (cityMatch) {
            let confidence = 0.96;
            confidence = applyGeoAdjustment(confidence, event, venue);
            if (confidence >= 0.95) {
              return { venueId: venue.id, confidence, stage: 1 };
            }
          }
        }
      }
    }
  }

  // 1c. URL host match
  const eventHost =
    extractHost(event.source_url) ?? extractHost(event.ticket_url);
  if (eventHost) {
    for (const venue of venueCache!) {
      if (venue.website_host && venue.website_host === eventHost) {
        let confidence = 0.97;
        confidence = applyGeoAdjustment(confidence, event, venue);
        return { venueId: venue.id, confidence, stage: 1 };
      }
    }
  }

  // === STAGE 2: Soft matches ===

  if (compactName && compactName.length > 2) {
    let bestMatch: VenueMatchResult = {
      venueId: null,
      confidence: 0,
      stage: null,
    };

    for (const venue of venueCache!) {
      const venueCompact = normalizeVenueNameCompact(venue.name);
      if (venueCompact.length < 3) continue;

      // 2a. Fuzzy name + same PLZ
      const titleSim = jaroWinkler(compactName, venueCompact);
      if (titleSim >= 0.85) {
        const plzMatch =
          event.postal_code &&
          venue.postal_code &&
          event.postal_code === venue.postal_code;
        if (plzMatch) {
          let confidence = 0.7 + (titleSim - 0.85) * 1.5; // 0.70-0.92
          confidence = applyGeoAdjustment(confidence, event, venue);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              venueId: venue.id,
              confidence: Math.min(confidence, 0.94),
              stage: 2,
            };
          }
        }
      }

      // 2b. Proximity (< 500m) + similar name
      if (
        event.latitude &&
        event.longitude &&
        venue.latitude &&
        venue.longitude
      ) {
        const dist = haversineDistance(
          event.latitude,
          event.longitude,
          venue.latitude,
          venue.longitude,
        );
        if (dist < 500 && titleSim >= 0.8) {
          let confidence = 0.75 + (titleSim - 0.8) * 1.0;
          confidence = Math.min(confidence, 0.94);
          if (confidence > bestMatch.confidence) {
            bestMatch = { venueId: venue.id, confidence, stage: 2 };
          }
        }
      }
    }

    if (bestMatch.venueId && bestMatch.confidence >= 0.7) {
      return bestMatch;
    }
  }

  // === STAGE 3: Uncertain — do NOT auto-map ===
  // Return null venue_id. The quality flag system will set venue_unmatched if appropriate.
  return { venueId: null, confidence: 0, stage: null };
}

function applyGeoAdjustment(
  confidence: number,
  event: { latitude?: number | null; longitude?: number | null },
  venue: { latitude?: number | null; longitude?: number | null },
): number {
  if (
    !event.latitude ||
    !event.longitude ||
    !venue.latitude ||
    !venue.longitude
  ) {
    return confidence;
  }
  const dist = haversineDistance(
    event.latitude,
    event.longitude,
    venue.latitude,
    venue.longitude,
  );
  if (dist < 200) return confidence + 0.15;
  if (dist > 2000) return confidence - 0.2;
  return confidence;
}
