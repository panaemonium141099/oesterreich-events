/**
 * DE-Adapter Modern Events Calendar (MEC, WordPress), fn-29.7.
 *
 * MEC bietet ohne Freischaltung weder iCal noch Termine über REST
 * (`/mec/v1/events` liefert `[]`, `/wp/v2/mec-events` keine Termine; der
 * Registry-Feed `/events/feed/` ist auf mehreren Websites der Kommentar-Feed,
 * 2026-10-29). Die Kalenderseite trägt aber JSON-LD je angezeigtem Termin
 * (34 von 62 Websites, 799 Termine). Gelesen wird die Kalenderseite der
 * Registry, ohne Termine dort `/events/`. Es kommen die Termine, die die
 * Seite anzeigt (meist die nächsten Wochen); spätere in den folgenden Nächten.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { ldEventsFromHtml, type LdEvent } from './jsonld';
import { collapseSourceDuplicates, terminContext } from './kontext';

/** Kalenderseiten aller MEC-Gemeinden, je Seite die Gemeinden, die sie führen. */
export function mecGroups(): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  for (const e of loadRegistryDe()) {
    if (e.integration !== 'mec' || !e.url) continue;
    const g = groups.get(e.url) ?? { feedUrl: e.url, pageUrl: e.url, own: [], viaVerband: [] };
    g.own.push(e);
    groups.set(e.url, g);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

const termin = (e: LdEvent) => ({ uid: e.url ?? e.name, title: e.name, start: e.start, end: e.end, locationName: e.locationName, street: e.street, locality: e.locality });

export class MecDeScraper extends DeFeedScraper {
  readonly name = 'de-mec';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = mecGroups().slice(0, this.limit ?? Infinity);
    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();
    for (const g of groups) {
      let events = ldEventsFromHtml((await this.fetchHtmlPage(g.pageUrl)) ?? '');
      const archive = `${new URL(g.pageUrl).origin}/events/`;
      if (!events.length && archive !== g.pageUrl) {
        events = ldEventsFromHtml((await this.fetchHtmlPage(archive)) ?? '');
        if (events.length) g.pageUrl = archive;
      }
      const unique = collapseSourceDuplicates(events.map(e => ({ ...termin(e), ev: e }))).map(x => x.ev);
      for (const ev of unique) {
        const s = this.toScraped(ev, g);
        // Mehrere Gemeinden einer Website teilen die Kalenderseite: ein Termin einmal.
        if (seen.has(s.source_id)) continue;
        seen.add(s.source_id);
        all.push(s);
      }
    }
    this.log(`${groups.length} Kalenderseiten, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: LdEvent, g: FeedGroup): ScrapedEvent {
    const host = new URL(g.pageUrl).host;
    const key = ev.url ? new URL(ev.url, g.pageUrl).pathname.replace(/\/+$/, '') : ev.name;
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `mec-${host}-${key}-${ev.localDate}`,
      source_url: ev.url ? new URL(ev.url, g.pageUrl).href : g.pageUrl,
      title: ev.name,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.name, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
