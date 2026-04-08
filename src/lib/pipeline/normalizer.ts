// @ts-nocheck — Pre-existing raw pipeline module, not yet integrated with live types
import type { NormalizedCandidate, DatePrecision } from './types';
import { normalizeTitle, normalizeTitleCompact } from './normalize-title';
import { normalizeDate } from './normalize-date';
import { normalizeUrl } from './normalize-url';

/**
 * Raw event row as stored in the raw_events staging table.
 * This is NOT the same as EventRow (which is the public events table).
 */
interface RawEventRow {
  id: string;
  source_url?: string | null;
  raw_title?: string | null;
  raw_start_text?: string | null;
  raw_end_text?: string | null;
  raw_location_name?: string | null;
  raw_address?: string | null;
  raw_ticket_url?: string | null;
  raw_image_url?: string | null;
  raw_payload_json?: Record<string, unknown> | null;
}

/** Extended NormalizedCandidate with raw-pipeline-specific fields */
interface RawNormalizedCandidate extends NormalizedCandidate {
  raw_event_id: string;
  normalized_title_compact: string;
  normalized_start_at: string | null;
  normalized_end_at: string | null;
  start_precision: DatePrecision;
  end_precision: DatePrecision | 'missing';
  normalized_ticket_url: string | null;
  normalized_source_url: string | null;
  normalized_image_url: string | null;
  normalized_category: string | null;
  normalized_organizer: string | null;
  language_code: string;
  parse_confidence: number;
  normalization_version: number;
}

const NORMALIZATION_VERSION = 1;

interface NormalizeResult {
  candidate: RawNormalizedCandidate | null;
  error: string | null;
}

/**
 * Normalize a single raw event into a candidate.
 * Returns { candidate, error } — one of the two will be null.
 */
export function normalizeRawEvent(raw: RawEventRow): NormalizeResult {
  // Title is required
  if (!raw.raw_title || raw.raw_title.trim().length === 0) {
    return { candidate: null, error: 'missing_title' };
  }

  const normalizedTitle = normalizeTitle(raw.raw_title);
  const normalizedTitleCompact = normalizeTitleCompact(raw.raw_title);

  // Date normalization
  const dateResult = normalizeDate(raw.raw_start_text ?? '');
  const endDateResult = raw.raw_end_text ? normalizeDate(raw.raw_end_text) : null;

  // URL normalization
  const normalizedTicketUrl = raw.raw_ticket_url ? normalizeUrl(raw.raw_ticket_url) : null;
  const normalizedSourceUrl = raw.source_url ? normalizeUrl(raw.source_url) : null;

  // Extract postal code from address (Austrian format: 4-digit PLZ)
  const postalCode = raw.raw_address?.match(/\b(\d{4})\b/)?.[1] ?? null;

  // Extract city from address after postal code (e.g., "1010 Wien" -> "Wien")
  const cityMatch = raw.raw_address?.match(/\d{4}\s+([A-Za-zÄÖÜäöüß]+(?:\s+[A-Za-zÄÖÜäöüß]+)?)/);
  const city = cityMatch?.[1] ?? null;

  // Category and metadata from raw_payload_json (the full ScrapedEvent stored there)
  const payload = raw.raw_payload_json as Record<string, unknown> | null;
  const category = (payload?.category as string) ?? null;
  const bundesland = (payload?.bundesland as string) ?? null;
  const organizer = (payload?.organizer as string) ?? null;

  const candidate: RawNormalizedCandidate = {
    source_id: raw.id,
    scraper_name: '',
    normalized_start_date: dateResult.startAt?.toISOString?.() ?? (typeof dateResult.startAt === 'string' ? dateResult.startAt : '') ?? '',
    raw_event_id: raw.id,
    normalized_title: normalizedTitle,
    normalized_title_compact: normalizedTitleCompact,
    normalized_start_at: dateResult.startAt?.toISOString() ?? null,
    normalized_end_at: endDateResult?.startAt?.toISOString() ?? dateResult.endAt?.toISOString() ?? null,
    start_precision: dateResult.startPrecision,
    end_precision: endDateResult ? endDateResult.startPrecision ?? 'missing' : dateResult.endPrecision,
    normalized_location_name: raw.raw_location_name ?? null,
    normalized_address: raw.raw_address ?? null,
    normalized_city: city,
    normalized_postal_code: postalCode,
    normalized_bundesland: bundesland,
    normalized_category: category,
    normalized_organizer: organizer,
    normalized_ticket_url: normalizedTicketUrl,
    normalized_source_url: normalizedSourceUrl,
    normalized_image_url: raw.raw_image_url ?? null,
    language_code: 'de',
    parse_confidence: computeParseConfidence(dateResult),
    normalization_version: NORMALIZATION_VERSION,
  };

  return { candidate, error: null };
}

function computeParseConfidence(
  dateResult: { startAt: Date | null; startPrecision: DatePrecision | null },
): number {
  let confidence = 0.5;
  if (dateResult.startAt) confidence += 0.2;
  if (dateResult.startPrecision === 'exact') confidence += 0.15;
  else if (dateResult.startPrecision === 'day_only') confidence += 0.05;
  return Math.min(confidence, 1.0);
}

/**
 * Normalize a batch of raw events. Returns candidates and errors separately.
 */
export async function normalizeEvents(rawEvents: RawEventRow[]): Promise<{
  candidates: NormalizedCandidate[];
  errors: Array<{ rawEventId: string; error: string }>;
}> {
  const candidates: NormalizedCandidate[] = [];
  const errors: Array<{ rawEventId: string; error: string }> = [];

  for (const raw of rawEvents) {
    const result = normalizeRawEvent(raw);
    if (result.candidate) {
      candidates.push(result.candidate);
    } else {
      errors.push({ rawEventId: raw.id, error: result.error ?? 'unknown' });
    }
  }

  return { candidates, errors };
}
