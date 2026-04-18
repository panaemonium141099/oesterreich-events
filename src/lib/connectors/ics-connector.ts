/**
 * ICS Connector — Parses iCalendar (.ics) feeds into ScrapedEvent[].
 *
 * Features:
 * - Fetches and parses ICS feeds from URLs or raw strings
 * - Expands RRULE recurring events within a configurable date window (default: 90 days)
 * - DST-safe date handling via luxon DateTime
 * - Extracts location, description, categories, and organizer from VEVENT components
 * - Handles RECURRENCE-ID overrides and EXDATE exclusions via node-ical's expandRecurringEvent
 * - Normalizes ParameterValue fields (strings or {val, params} objects)
 *
 * Usage:
 *   const connector = new ICSConnector({ sourceName: 'my-venue' });
 *   const events = await connector.fromURL('https://example.com/calendar.ics');
 *   // or
 *   const events = connector.fromString(icsText);
 */

import * as ical from 'node-ical';
import { DateTime } from 'luxon';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import type { VEvent, ParameterValue, CalendarComponent, EventInstance } from 'node-ical';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ICSConnectorOptions {
  /** Source name for generated events (e.g., venue name or scraper identifier) */
  sourceName: string;

  /** Base URL for source_url on generated events (fallback if VEVENT has no URL) */
  sourceUrl?: string;

  /** Number of days into the future to expand recurring events (default: 90) */
  expandDays?: number;

  /** Bundesland to assign to events if not derivable from the feed */
  defaultBundesland?: string;

  /** Venue ID to attach to generated events */
  venueId?: string;

  /** Location name fallback if VEVENT has no LOCATION */
  defaultLocationName?: string;

  /** Default latitude/longitude if VEVENT has no GEO */
  defaultLatitude?: number;
  defaultLongitude?: number;

  /** IANA timezone for interpreting floating (no-TZ) dates. Default: 'Europe/Vienna' */
  defaultTimezone?: string;

  /** User-Agent header for HTTP requests */
  userAgent?: string;

  /** Maximum number of events to return (safety limit). Default: 5000 */
  maxEvents?: number;
}

export interface ICSParseResult {
  events: ScrapedEvent[];
  /** Calendar name from X-WR-CALNAME if present */
  calendarName?: string;
  /** Total VEVENT components found (before expansion) */
  rawEventCount: number;
  /** Total events after RRULE expansion */
  expandedEventCount: number;
  /** Errors encountered during parsing (non-fatal) */
  warnings: string[];
}

// ── Connector ─────────────────────────────────────────────────────────────────

export class ICSConnector {
  private readonly sourceName: string;
  private readonly sourceUrl: string;
  private readonly expandDays: number;
  private readonly defaultBundesland?: string;
  private readonly venueId?: string;
  private readonly defaultLocationName?: string;
  private readonly defaultLatitude?: number;
  private readonly defaultLongitude?: number;
  private readonly defaultTimezone: string;
  private readonly userAgent: string;
  private readonly maxEvents: number;

  constructor(options: ICSConnectorOptions) {
    this.sourceName = options.sourceName;
    this.sourceUrl = options.sourceUrl ?? '';
    this.expandDays = options.expandDays ?? 90;
    this.defaultBundesland = options.defaultBundesland;
    this.venueId = options.venueId;
    this.defaultLocationName = options.defaultLocationName;
    this.defaultLatitude = options.defaultLatitude;
    this.defaultLongitude = options.defaultLongitude;
    this.defaultTimezone = options.defaultTimezone ?? 'Europe/Vienna';
    this.userAgent = options.userAgent ?? 'BurgenlandEvents-ICSConnector/1.0';
    this.maxEvents = options.maxEvents ?? 5000;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch and parse an ICS feed from a URL.
   */
  async fromURL(url: string): Promise<ICSParseResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/calendar, application/calendar+json, */*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`ICS fetch failed: HTTP ${response.status} ${response.statusText} from ${url}`);
    }

    const text = await response.text();
    return this.fromString(text, url);
  }

  /**
   * Parse an ICS string directly.
   * @param icsText Raw ICS content
   * @param feedUrl Optional URL for source_url attribution
   */
  fromString(icsText: string, feedUrl?: string): ICSParseResult {
    const warnings: string[] = [];
    const parsed = ical.parseICS(icsText);

    // Extract calendar metadata
    const calendarName = parsed.vcalendar?.['WR-CALNAME'] as string | undefined;
    const calendarTz = parsed.vcalendar?.['WR-TIMEZONE'] as string | undefined;
    const effectiveTz = calendarTz || this.defaultTimezone;

    // Collect all VEVENTs
    const vevents: VEvent[] = [];
    for (const key of Object.keys(parsed)) {
      if (key === 'vcalendar') continue;
      const component = parsed[key] as CalendarComponent | undefined;
      if (component && component.type === 'VEVENT') {
        vevents.push(component as VEvent);
      }
    }

    const rawEventCount = vevents.length;

    // Date window for expansion
    const now = DateTime.now().setZone(effectiveTz);
    const rangeStart = now.startOf('day');
    const rangeEnd = rangeStart.plus({ days: this.expandDays });
    const jsFrom = rangeStart.toJSDate();
    const jsTo = rangeEnd.toJSDate();

    const events: ScrapedEvent[] = [];

    for (const vevent of vevents) {
      try {
        if (vevent.rrule) {
          // Recurring event: expand instances within the window
          const instances = ical.expandRecurringEvent(vevent, {
            from: jsFrom,
            to: jsTo,
            includeOverrides: true,
            excludeExdates: true,
          });

          for (const instance of instances) {
            if (events.length >= this.maxEvents) {
              warnings.push(`Reached max events limit (${this.maxEvents}), stopping expansion`);
              break;
            }
            const scraped = this.instanceToScrapedEvent(instance, vevent, effectiveTz, feedUrl);
            if (scraped) events.push(scraped);
          }
        } else {
          // Single (non-recurring) event: include if within the window
          const startDt = this.toDateTime(vevent.start, effectiveTz);
          if (!startDt) {
            warnings.push(`Skipping event "${paramValue(vevent.summary)}": no valid start date`);
            continue;
          }

          // Include if event starts within our window, or ends within our window
          const endDt = vevent.end ? this.toDateTime(vevent.end, effectiveTz) : null;
          const eventEnd = endDt ?? startDt;

          if (startDt > rangeEnd && eventEnd < rangeStart) {
            continue; // Entirely outside the window
          }
          if (eventEnd < rangeStart) continue; // Already ended
          if (startDt > rangeEnd) continue; // Too far in the future

          const scraped = this.veventToScrapedEvent(vevent, effectiveTz, feedUrl);
          if (scraped) events.push(scraped);
        }
      } catch (err) {
        const title = paramValue(vevent.summary) ?? vevent.uid;
        warnings.push(`Error processing "${title}": ${err instanceof Error ? err.message : String(err)}`);
      }

      if (events.length >= this.maxEvents) {
        if (!warnings.some(w => w.includes('max events limit'))) {
          warnings.push(`Reached max events limit (${this.maxEvents}), stopping expansion`);
        }
        break;
      }
    }

    return {
      events,
      calendarName,
      rawEventCount,
      expandedEventCount: events.length,
      warnings,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Convert an expanded EventInstance to a ScrapedEvent.
   */
  private instanceToScrapedEvent(
    instance: EventInstance,
    baseEvent: VEvent,
    timezone: string,
    feedUrl?: string,
  ): ScrapedEvent | null {
    const title = typeof instance.summary === 'string'
      ? instance.summary
      : instance.summary?.val;
    if (!title || title.trim().length < 2) return null;

    const startDt = this.toDateTime(instance.start, timezone);
    if (!startDt) return null;

    const endDt = instance.end ? this.toDateTime(instance.end, timezone) : null;

    // Use the instance's own event (could be an override) for description/location
    const event = instance.event ?? baseEvent;

    return this.buildScrapedEvent({
      title: title.trim(),
      startIso: startDt.toISO()!,
      endIso: endDt?.toISO() ?? undefined,
      isAllDay: instance.isFullDay,
      event,
      feedUrl,
    });
  }

  /**
   * Convert a single non-recurring VEvent to a ScrapedEvent.
   */
  private veventToScrapedEvent(
    vevent: VEvent,
    timezone: string,
    feedUrl?: string,
  ): ScrapedEvent | null {
    const title = paramValue(vevent.summary);
    if (!title || title.trim().length < 2) return null;

    const startDt = this.toDateTime(vevent.start, timezone);
    if (!startDt) return null;

    const endDt = vevent.end ? this.toDateTime(vevent.end, timezone) : null;
    const isAllDay = vevent.datetype === 'date';

    return this.buildScrapedEvent({
      title: title.trim(),
      startIso: startDt.toISO()!,
      endIso: endDt?.toISO() ?? undefined,
      isAllDay,
      event: vevent,
      feedUrl,
    });
  }

  /**
   * Shared builder for ScrapedEvent from parsed VEVENT data.
   */
  private buildScrapedEvent(params: {
    title: string;
    startIso: string;
    endIso?: string;
    isAllDay: boolean;
    event: VEvent;
    feedUrl?: string;
  }): ScrapedEvent {
    const { title, startIso, endIso, event, feedUrl } = params;

    const description = paramValue(event.description)?.trim().slice(0, 2000) || undefined;
    const locationName = paramValue(event.location)?.trim() || this.defaultLocationName;
    const eventUrl = (event.url as string | undefined) ?? feedUrl ?? this.sourceUrl;

    // Extract organizer name
    let organizer: string | undefined;
    if (event.organizer) {
      if (typeof event.organizer === 'string') {
        organizer = event.organizer.replace(/^mailto:/i, '');
      } else {
        organizer = event.organizer.params?.CN || event.organizer.val?.replace(/^mailto:/i, '');
      }
    }

    // Extract categories/tags from ICS CATEGORIES field
    const tags: string[] = [];
    if (event.categories && Array.isArray(event.categories)) {
      tags.push(...event.categories);
    }

    // Generate stable source_id from UID + start date
    const dateSlug = startIso.slice(0, 10);
    const uidSlug = (event.uid ?? title).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);
    const sourceId = `ics-${this.sourceName}-${uidSlug}-${dateSlug}`;

    // Extract GEO coordinates if available
    let latitude = this.defaultLatitude;
    let longitude = this.defaultLongitude;
    if (event.geo) {
      const geo = event.geo;
      if (typeof geo === 'object' && geo.lat != null && geo.lon != null) {
        latitude = Number(geo.lat);
        longitude = Number(geo.lon);
      }
    }

    return {
      source_id: sourceId,
      source_name: this.sourceName,
      source_url: eventUrl,
      title,
      description,
      start_date: startIso,
      end_date: endIso,
      location_name: locationName,
      bundesland: this.defaultBundesland,
      latitude,
      longitude,
      category: categorizeEvent(title + (description ? ` ${description}` : '')),
      organizer,
      tags: tags.length > 0 ? tags : undefined,
    };
  }

  /**
   * Convert a Date (possibly with .tz property from node-ical) to a luxon DateTime,
   * correctly handling DST transitions.
   */
  private toDateTime(date: Date & { tz?: string; dateOnly?: true }, fallbackTz: string): DateTime | null {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;

    if (date.dateOnly) {
      // Date-only values (VALUE=DATE): node-ical converts these to local midnight
      // in the system timezone. We extract the local date parts and create a
      // DateTime in the target timezone to preserve the correct calendar date.
      return DateTime.fromObject(
        {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
        },
        { zone: fallbackTz },
      );
    }

    // If node-ical attached a timezone, use it; otherwise use fallback
    const tz = date.tz || fallbackTz;

    if (tz === 'Etc/UTC' || tz === 'UTC' || tz === 'Z') {
      return DateTime.fromJSDate(date, { zone: 'utc' });
    }

    // For events with a known timezone, create the DateTime in that zone.
    // node-ical stores the UTC instant in the Date object, but the .tz tells us
    // what timezone the original DTSTART was specified in.
    return DateTime.fromJSDate(date, { zone: tz });
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Extract the string value from a node-ical ParameterValue.
 * Handles both plain strings and {val, params} objects.
 */
export function paramValue(pv: ParameterValue | undefined | null): string | undefined {
  if (pv == null) return undefined;
  if (typeof pv === 'string') return pv;
  if (typeof pv === 'object' && 'val' in pv) return String(pv.val);
  return undefined;
}
