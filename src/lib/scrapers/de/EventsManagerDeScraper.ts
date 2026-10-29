/**
 * DE-Adapter Events Manager (fn-29.7): liest `/events.ics` aller
 * Events-Manager-Kalender der DE-Gemeinde-Registry. Kontext wie bei den
 * übrigen DE-Adaptern (`kontext.ts`).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { emCompleteDays, parseEmIcs, type EmEvent } from './em';
import { collapseSourceDuplicates, terminContext } from './kontext';

export class EventsManagerDeScraper extends DeFeedScraper {
  readonly name = 'de-eventsmanager';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('eventsmanager').slice(0, this.limit ?? Infinity);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const ics = await this.fetchFeed(g.feedUrl);
      if (ics == null) continue;
      const events = parseEmIcs(ics);
      const complete = emCompleteDays(events);
      if (complete.length !== events.length) this.log(`Grenze erreicht: ${g.feedUrl} (${events.length} Termine, letzter Tag ausgelassen)`);
      all.push(...collapseSourceDuplicates(complete).map(ev => this.toScraped(ev, g)));
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: EmEvent, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `em-${new URL(g.feedUrl).host}-${ev.uid}-${ev.localDate}`,
      source_url: ev.url ?? g.pageUrl,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      category: ev.category,
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
