/**
 * DE-Adapter The Events Calendar (fn-29.7): liest die REST-Liste aller
 * Tribe-Kalender der DE-Gemeinde-Registry, ein Jahr ab heute, seitenweise.
 * Kontext wie bei ionas: die Gemeinde eines Feeds, den genau eine Gemeinde
 * führt; im Amtskalender nur die Gemeinde, die der Termin selbst nennt.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { parseTribePage, tribePageUrl, type TribeEvent } from './tribe';

/** Höchstens so viele Seiten à 50 je Kalender (2.000 Termine). */
const MAX_PAGES = 40;

export class TribeDeScraper extends DeFeedScraper {
  readonly name = 'de-tribe';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('tribe').slice(0, this.limit ?? Infinity);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const events: TribeEvent[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const body = await this.fetchFeed(tribePageUrl(g.feedUrl, from, to, page));
        if (body == null) break;
        let p;
        try {
          p = parseTribePage(body);
        } catch {
          this.log(`kein JSON: ${g.feedUrl} Seite ${page}`);
          break;
        }
        events.push(...p.events);
        if (page >= p.totalPages) break;
        if (page === MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${g.feedUrl}`);
      }
      all.push(...collapseSourceDuplicates(events).map(ev => this.toScraped(ev, g)));
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: TribeEvent, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `tribe-${new URL(g.feedUrl).host}-${ev.uid}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      category: ev.category,
      price_text: ev.priceText,
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
