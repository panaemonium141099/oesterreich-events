import { getDatabase } from './connection';
import type { Event, EventFilters, ScrapedEvent } from '@/types/events';
import {
  classifyDeterministic,
  categoryConfidenceRank,
  CLASSIFIER_VERSION,
} from '@/lib/category-classifier';

export function getEvents(filters: EventFilters = {}): { events: Event[]; total: number } {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.bundesland && filters.bundesland !== 'all') {
    conditions.push('bundesland = @bundesland');
    params.bundesland = filters.bundesland;
  }

  if (filters.district) {
    conditions.push('district = @district');
    params.district = filters.district;
  }

  if (filters.tags && filters.tags.length > 0) {
    // Multi-tag filter via event_tags junction table (OR logic: any matching tag)
    const tagPlaceholders = filters.tags.map((_, i) => `@tag_${i}`).join(', ');
    conditions.push(`id IN (SELECT event_id FROM event_tags WHERE tag IN (${tagPlaceholders}))`);
    filters.tags.forEach((tag, i) => {
      params[`tag_${i}`] = tag;
    });
  } else if (filters.category) {
    conditions.push('category = @category');
    params.category = filters.category;
  }

  if (filters.dateFrom) {
    conditions.push('substr(start_date, 1, 10) >= @dateFrom');
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push('substr(start_date, 1, 10) <= @dateTo');
    params.dateTo = filters.dateTo;
  }

  if (filters.eveningOnly) {
    // Evening events: start time >= 17:00
    // Also include events without time info (pure date or T00:00 = unknown time)
    conditions.push(`(
      substr(start_date, 12, 2) >= '17'
      OR start_date NOT LIKE '%T%'
      OR substr(start_date, 12, 5) = '00:00'
    )`);
  }

  if (filters.priceMin !== undefined) {
    conditions.push('(price_min >= @priceMin OR price_min IS NULL)');
    params.priceMin = filters.priceMin;
  }

  if (filters.priceMax !== undefined) {
    conditions.push('(price_max <= @priceMax OR price_max IS NULL)');
    params.priceMax = filters.priceMax;
  }

  if (filters.search) {
    conditions.push('(title LIKE @search OR description LIKE @search OR location_name LIKE @search)');
    params.search = `%${filters.search}%`;
  }

  // Only show future/current events by default
  conditions.push("start_date >= date('now')");

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = filters.offset || 0;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM events ${where}`).get(params) as { total: number };
  const events = filters.limit
    ? db.prepare(`SELECT * FROM events ${where} ORDER BY start_date ASC LIMIT @limit OFFSET @offset`).all({ ...params, limit: filters.limit, offset }) as Event[]
    : db.prepare(`SELECT * FROM events ${where} ORDER BY start_date ASC`).all(params) as Event[];

  return { events, total: countRow.total };
}

export function getEventById(id: number): Event | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event) || null;
}

export function upsertEvent(event: ScrapedEvent): { isNew: boolean } {
  const db = getDatabase();

  // Cross-source deduplication: skip if same source_id exists from ANY source
  const crossDupe = db.prepare(
    'SELECT id, source_name FROM events WHERE source_id = ? AND source_name != ?'
  ).get(event.source_id, event.source_name) as { id: number; source_name: string } | undefined;
  if (crossDupe) {
    return { isNew: false }; // Already exists from another source
  }

  const existing = db.prepare(
    `SELECT id, category, tags, category_confidence, category_source,
            category_version, category_locked, category_needs_review,
            category_reason, category_candidates
       FROM events WHERE source_name = ? AND source_id = ?`,
  ).get(event.source_name, event.source_id) as
    | {
        id: number;
        category: string | null;
        tags: string | null;
        category_confidence: string | null;
        category_source: string | null;
        category_version: string | null;
        category_locked: number | null;
        category_needs_review: number | null;
        category_reason: string | null;
        category_candidates: string | null;
      }
    | undefined;

  // Central classifier: deterministic run using the full signal set.
  const outcome = classifyDeterministic({
    title: event.title,
    description: event.description ?? null,
    source_tags_raw: event.tags ?? null,
    source_category_raw: event.category ?? null,
    source_name: event.source_name,
    organizer: event.organizer ?? null,
    location_name: event.location_name ?? null,
  });

  // Reconcile with existing row: respect the lock, and never downgrade
  // confidence silently when the stored row was already classified at a
  // higher rank with the current classifier version.
  const existingLocked = Boolean(existing?.category_locked);
  const existingRank = categoryConfidenceRank(existing?.category_confidence);
  const newRank = categoryConfidenceRank(outcome.confidence);
  const existingIsCurrentVersion = existing?.category_version === CLASSIFIER_VERSION;
  const keepExistingCategory =
    existingLocked ||
    (!!existing?.category_confidence && existingIsCurrentVersion && existingRank < newRank);

  const finalCategory = keepExistingCategory && existing
    ? existing.category
    : outcome.category;
  const finalTags = keepExistingCategory && existing?.tags
    ? (JSON.parse(existing.tags) as string[])
    : outcome.tags;
  const finalConfidence = keepExistingCategory && existing
    ? existing.category_confidence
    : outcome.confidence;
  const finalSource = keepExistingCategory && existing
    ? existing.category_source
    : outcome.source;
  const finalVersion = keepExistingCategory && existing
    ? existing.category_version
    : outcome.version;
  const finalNeedsReview = keepExistingCategory && existing
    ? Boolean(existing.category_needs_review)
    : outcome.needsReview;
  const finalReason = keepExistingCategory && existing
    ? existing.category_reason
    : outcome.reason;
  const finalCandidates = keepExistingCategory && existing?.category_candidates
    ? existing.category_candidates
    : JSON.stringify(outcome.candidates);
  const finalLocked = existingLocked ? 1 : 0;

  const sourceCategoryRaw = event.category ?? null;
  const sourceTagsRawJson = event.tags ? JSON.stringify(event.tags) : null;

  if (existing) {
    db.prepare(`
      UPDATE events SET
        source_url = @source_url,
        title = @title,
        description = @description,
        start_date = @start_date,
        end_date = @end_date,
        location_name = @location_name,
        address = @address,
        postal_code = @postal_code,
        bundesland = @bundesland,
        district = @district,
        latitude = @latitude,
        longitude = @longitude,
        category = @category,
        price_text = @price_text,
        price_min = @price_min,
        price_max = @price_max,
        image_url = @image_url,
        organizer = @organizer,
        tags = @tags,
        ticket_url = @ticket_url,
        source_category_raw = @source_category_raw,
        source_tags_raw = @source_tags_raw,
        category_confidence = @category_confidence,
        category_source = @category_source,
        category_version = @category_version,
        category_locked = @category_locked,
        category_needs_review = @category_needs_review,
        category_reason = @category_reason,
        category_candidates = @category_candidates,
        updated_at = datetime('now')
      WHERE source_name = @source_name AND source_id = @source_id
    `).run({
      source_url: event.source_url,
      title: event.title,
      description: event.description || null,
      start_date: event.start_date,
      end_date: event.end_date || null,
      location_name: event.location_name || null,
      address: event.address || null,
      postal_code: event.postal_code || null,
      bundesland: event.bundesland || null,
      district: event.district || null,
      latitude: event.latitude || null,
      longitude: event.longitude || null,
      category: finalCategory,
      price_text: event.price_text || null,
      price_min: event.price_min || null,
      price_max: event.price_max || null,
      image_url: event.image_url || null,
      organizer: event.organizer || null,
      tags: finalTags ? JSON.stringify(finalTags) : null,
      ticket_url: event.ticket_url || null,
      source_category_raw: sourceCategoryRaw,
      source_tags_raw: sourceTagsRawJson,
      category_confidence: finalConfidence,
      category_source: finalSource,
      category_version: finalVersion,
      category_locked: finalLocked,
      category_needs_review: finalNeedsReview ? 1 : 0,
      category_reason: finalReason,
      category_candidates: finalCandidates,
      source_name: event.source_name,
      source_id: event.source_id,
    });

    // Sync event_tags junction table with the final canonical tags.
    syncEventTags(db, existing.id, finalTags);

    return { isNew: false };
  }

  const result = db.prepare(`
    INSERT INTO events (
      source_id, source_name, source_url, title, description,
      start_date, end_date, location_name, address, postal_code,
      bundesland, district, latitude, longitude, category, price_text,
      price_min, price_max, image_url, organizer, tags, ticket_url,
      source_category_raw, source_tags_raw, category_confidence,
      category_source, category_version, category_locked,
      category_needs_review, category_reason, category_candidates
    ) VALUES (
      @source_id, @source_name, @source_url, @title, @description,
      @start_date, @end_date, @location_name, @address, @postal_code,
      @bundesland, @district, @latitude, @longitude, @category, @price_text,
      @price_min, @price_max, @image_url, @organizer, @tags, @ticket_url,
      @source_category_raw, @source_tags_raw, @category_confidence,
      @category_source, @category_version, @category_locked,
      @category_needs_review, @category_reason, @category_candidates
    )
  `).run({
    source_id: event.source_id,
    source_name: event.source_name,
    source_url: event.source_url,
    title: event.title,
    description: event.description || null,
    start_date: event.start_date,
    end_date: event.end_date || null,
    location_name: event.location_name || null,
    address: event.address || null,
    postal_code: event.postal_code || null,
    bundesland: event.bundesland || null,
    district: event.district || null,
    latitude: event.latitude || null,
    longitude: event.longitude || null,
    category: finalCategory,
    price_text: event.price_text || null,
    price_min: event.price_min || null,
    price_max: event.price_max || null,
    image_url: event.image_url || null,
    organizer: event.organizer || null,
    tags: finalTags ? JSON.stringify(finalTags) : null,
    ticket_url: event.ticket_url || null,
    source_category_raw: sourceCategoryRaw,
    source_tags_raw: sourceTagsRawJson,
    category_confidence: finalConfidence,
    category_source: finalSource,
    category_version: finalVersion,
    category_locked: finalLocked,
    category_needs_review: finalNeedsReview ? 1 : 0,
    category_reason: finalReason,
    category_candidates: finalCandidates,
  });

  // Write to event_tags junction table with final canonical tags.
  const newEventId = result.lastInsertRowid as number;
  syncEventTags(db, newEventId, finalTags);

  return { isNew: true };
}

/**
 * Sync the event_tags junction table for a given event.
 * Replaces all existing tags with the new set.
 */
function syncEventTags(db: import('better-sqlite3').Database, eventId: number, tags: string[]): void {
  db.prepare('DELETE FROM event_tags WHERE event_id = ?').run(eventId);
  const insert = db.prepare('INSERT OR IGNORE INTO event_tags (event_id, tag) VALUES (?, ?)');
  for (const tag of tags) {
    insert.run(eventId, tag);
  }
}

export function recordScrapeRun(sourceName: string) {
  const db = getDatabase();
  const result = db.prepare(
    `INSERT INTO scrape_runs (source_name, started_at, status) VALUES (?, datetime('now'), 'running')`
  ).run(sourceName);

  const runId = result.lastInsertRowid as number;

  return {
    finish(stats: { eventsFound: number; eventsNew: number; eventsUpdated: number }) {
      db.prepare(`
        UPDATE scrape_runs SET
          finished_at = datetime('now'),
          status = 'success',
          events_found = ?,
          events_new = ?,
          events_updated = ?
        WHERE id = ?
      `).run(stats.eventsFound, stats.eventsNew, stats.eventsUpdated, runId);
    },
    fail(error: string) {
      db.prepare(`
        UPDATE scrape_runs SET
          finished_at = datetime('now'),
          status = 'error',
          error_message = ?
        WHERE id = ?
      `).run(error, runId);
    },
  };
}
