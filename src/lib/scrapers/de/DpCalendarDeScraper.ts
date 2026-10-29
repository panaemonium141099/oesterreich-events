/**
 * DE-Adapter DPCalendar (Joomla), fn-29.7: liest den iCal-Export aller
 * DPCalendar-Kalender der DE-Gemeinde-Registry, löst Wiederholungen ein Jahr
 * ab heute auf. Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { parseDpIcs, type DpEvent } from './dpcalendar';
import { parseEmLocation } from './em';
import { collapseSourceDuplicates, terminContext } from './kontext';

export class DpCalendarDeScraper extends DeFeedScraper {
  readonly name = 'de-dpcalendar';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('dpcalendar').slice(0, this.limit ?? Infinity);
    const from = new Date();
    const to = new Date(from.getTime() + 365 * 86_400_000);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const ics = await this.fetchFeed(g.feedUrl);
      if (ics == null) continue;
      const events = parseDpIcs(ics, from, to).map(e => ({ ...e, ...parseEmLocation(e.location) }));
      all.push(...collapseSourceDuplicates(events).map(ev => this.toScraped(ev, g)));
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: DpEvent & ReturnType<typeof parseEmLocation>, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `dp-${new URL(g.feedUrl).host}-${ev.uid}-${ev.localDate}`,
      source_url: ev.url && /^https?:\/\//.test(ev.url) ? ev.url : g.pageUrl,
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
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
