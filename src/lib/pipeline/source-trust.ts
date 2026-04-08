// src/lib/pipeline/source-trust.ts
//
// Computes per-source trust scores from the events table.

export interface SourceTrustScore {
  sourceName: string;
  eventCount: number;
  avgQualityScore: number;
  venueMatchRate: number;
  duplicateRate: number;
  coordsRate: number;
  descriptionRate: number;
  imageRate: number;
  ticketRate: number;
  futureEventRate: number;
  trustScore: number;
}

export interface SourceTrustRawMetrics {
  total: number;
  qualitySum: number;
  withVenue: number;
  duplicates: number;
  withCoords: number;
  withDescription: number;
  withImage: number;
  withTicket: number;
  futureEvents: number;
}

/**
 * Compute trust score from raw metrics.
 * Pure function -- no DB access. Easy to test.
 */
export function computeTrustScoreFromMetrics(
  sourceName: string,
  m: SourceTrustRawMetrics
): SourceTrustScore {
  if (m.total === 0) {
    return {
      sourceName,
      eventCount: 0,
      avgQualityScore: 0,
      venueMatchRate: 0,
      duplicateRate: 0,
      coordsRate: 0,
      descriptionRate: 0,
      imageRate: 0,
      ticketRate: 0,
      futureEventRate: 0,
      trustScore: 0,
    };
  }

  const avgQualityScore = m.qualitySum / m.total;
  const venueMatchRate = m.withVenue / m.total;
  const duplicateRate = m.duplicates / m.total;
  const coordsRate = m.withCoords / m.total;
  const descriptionRate = m.withDescription / m.total;
  const imageRate = m.withImage / m.total;
  const ticketRate = m.withTicket / m.total;
  const futureEventRate = m.futureEvents / m.total;

  // Weighted composite 0-100
  // avgQuality is 0-100, rates are 0-1 so we scale rates to 0-100
  const trustScore = Math.round(
    (avgQualityScore / 100) * 0.4 * 100 +
    venueMatchRate * 0.15 * 100 +
    coordsRate * 0.15 * 100 +
    descriptionRate * 0.1 * 100 +
    imageRate * 0.05 * 100 +
    futureEventRate * 0.05 * 100 +
    (1 - duplicateRate) * 0.1 * 100
  );

  return {
    sourceName,
    eventCount: m.total,
    avgQualityScore: Math.round(avgQualityScore * 10) / 10,
    venueMatchRate: Math.round(venueMatchRate * 1000) / 10,
    duplicateRate: Math.round(duplicateRate * 1000) / 10,
    coordsRate: Math.round(coordsRate * 1000) / 10,
    descriptionRate: Math.round(descriptionRate * 1000) / 10,
    imageRate: Math.round(imageRate * 1000) / 10,
    ticketRate: Math.round(ticketRate * 1000) / 10,
    futureEventRate: Math.round(futureEventRate * 1000) / 10,
    trustScore: Math.min(100, Math.max(0, trustScore)),
  };
}

/**
 * Aggregate raw metrics from an array of event rows.
 * Expects the minimal set of fields needed.
 */
export function aggregateMetrics(
  events: Array<{
    quality_score?: number | null;
    venue_id?: string | null;
    publish_status?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description?: string | null;
    image_url?: string | null;
    ticket_url?: string | null;
    start_date?: string | null;
  }>,
  today: string
): SourceTrustRawMetrics {
  const m: SourceTrustRawMetrics = {
    total: events.length,
    qualitySum: 0,
    withVenue: 0,
    duplicates: 0,
    withCoords: 0,
    withDescription: 0,
    withImage: 0,
    withTicket: 0,
    futureEvents: 0,
  };

  for (const e of events) {
    m.qualitySum += e.quality_score ?? 0;
    if (e.venue_id) m.withVenue++;
    if (e.publish_status === 'duplicate') m.duplicates++;
    if (e.latitude != null && e.longitude != null) m.withCoords++;
    if (e.description && e.description.length > 50) m.withDescription++;
    if (e.image_url) m.withImage++;
    if (e.ticket_url) m.withTicket++;
    if (e.start_date && e.start_date >= today) m.futureEvents++;
  }

  return m;
}
