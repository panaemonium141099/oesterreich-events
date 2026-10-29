/**
 * DE-Adapter ionas (fn-29.5): liest die iCal-Exporte aller ionas-Kalender
 * der DE-Gemeinde-Registry. Ein Feed, den genau eine Gemeinde als eigenen
 * Kalender führt, bekommt deren Kontext (Ort, PLZ, Mittelpunkt als
 * Gebietsangabe); ein Amtskalender nur den Kontext des Landes, der Ort kommt
 * dann allein aus dem Termin (Etiketten-Regel des Qualitätsvertrags).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { ionasIcsUrl, parseIonasIcs, type IonasEvent } from './ionas';
import { collapseSourceDuplicates, terminContext } from './kontext';

export class IonasDeScraper extends DeFeedScraper {
  readonly name = 'de-ionas';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('ionas').slice(0, this.limit ?? Infinity);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const ics = await this.fetchFeed(ionasIcsUrl(g.feedUrl, from, to));
      if (ics == null) continue;
      const events = collapseSourceDuplicates(parseIonasIcs(ics));
      all.push(...events.map(ev => this.toScraped(ev, g)));
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: IonasEvent, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `ionas-${ev.uid}-${ev.localDate}`,
      source_url: g.pageUrl,
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
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
