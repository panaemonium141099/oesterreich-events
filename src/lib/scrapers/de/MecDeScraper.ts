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
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { ldEventsFromHtml, type LdEvent } from './jsonld';
import { collapseSourceDuplicates, terminContext } from './kontext';

/** Kalenderseiten aller MEC-Gemeinden, je Seite die Gemeinden, die sie führen. */
export function mecGroups(): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  for (const e of loadRegistryDe()) {
    if (e.integration !== 'mec') continue;
    // Ohne Kalenderseite (die Registry verwirft Plugin-Dateien als URL) das MEC-Archiv.
    const url = e.url ?? (e.host ? `https://${e.host}/events/` : null);
    if (!url) continue;
    const g = groups.get(url) ?? { feedUrl: url, pageUrl: url, own: [], viaVerband: [] };
    g.own.push(e);
    groups.set(url, g);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * Die Monatsansicht wiederholt einen laufenden mehrtägigen Termin an jedem
 * angezeigten Tag, mit diesem Tag als Beginn und dem echten Ende
 * (Zella-Mehlis „Zwei Generationen" 29.10., 30.10., 31.10., 01.11., jeweils
 * bis 30.04.2027; Beginn laut Detailseite 19.09.2026). Einträge mit derselben
 * Detailseite und demselben Ende sind ein Termin; Beginn und Ende kommen
 * danach von der Detailseite.
 */
export function collapseRunningRepeats(events: LdEvent[]): LdEvent[] {
  const first = new Map<string, LdEvent>();
  const out: LdEvent[] = [];
  for (const e of events) {
    if (!e.url || !e.end || e.end.slice(0, 10) <= e.localDate) { out.push(e); continue; }
    const k = `${e.url}|${e.end}`;
    const f = first.get(k);
    if (!f) { first.set(k, e); out.push(e); }
    else if (e.localDate < f.localDate) out[out.indexOf(f)] = e, first.set(k, e);
  }
  return out;
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
      events = await this.withDetailDates(events, g.pageUrl);
      const unique = withoutPlaceholderImages(collapseSourceDuplicates(events.map(e => ({ ...termin(e), image: e.image, ev: e }))))
        .map(x => (x.image === x.ev.image ? x.ev : { ...x.ev, image: undefined, imageWidth: undefined, imageHeight: undefined }));
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

  /**
   * Das JSON-LD der Kalenderseite verschiebt ganztägige Termine teils um einen
   * Tag (Widget in UTC: Kindenheim „Abgabebasar" Liste 29.10., Detailseite und
   * Anzeige 30.10.) und zeigt laufende Ausstellungen ab dem ersten sichtbaren
   * Tag statt ab ihrem Beginn (Zella-Mehlis „500 Jahre Schützentradition", seit
   * 17.05.). Gemessen 2026-10-29: 314 von 332 gleich, 7 Einzeltermine 1 bis 2
   * Tage zu früh, 4 Ausstellungen. Einzeltermine (eine Zeile je Detailseite)
   * bekommen deshalb Datum, Ende und Bild der Detailseite; Serien behalten
   * die Termine der Liste, die Detailseite zeigt nur den nächsten.
   */
  private async withDetailDates(listed: LdEvent[], pageUrl: string): Promise<LdEvent[]> {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const events = collapseRunningRepeats(listed);
    const count = new Map<string, number>();
    for (const e of events) if (e.url) count.set(e.url, (count.get(e.url) ?? 0) + 1);
    const out: LdEvent[] = [];
    for (const e of events) {
      if (!e.url || count.get(e.url) !== 1 || e.localDate < yesterday) { out.push(e); continue; }
      const html = await this.fetchHtmlPage(new URL(e.url, pageUrl).href);
      const d = html ? ldEventsFromHtml(html).find(x => x.name === e.name) : undefined;
      out.push(d ? { ...e, start: d.start, end: d.end, allDay: d.allDay, localDate: d.localDate, ...(d.image ? { image: d.image, imageWidth: d.imageWidth, imageHeight: d.imageHeight } : {}) } : e);
    }
    return out;
  }

  toScraped(ev: LdEvent, g: FeedGroup): ScrapedEvent {
    const host = new URL(g.pageUrl).host;
    const key = ev.url ? new URL(ev.url, g.pageUrl).pathname.replace(/\/+$/, '') : ev.name;
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const sourceUrl = ev.url ? new URL(ev.url, g.pageUrl).href : g.pageUrl;
    const image = imageUrl(ev.image, sourceUrl);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `mec-${host}-${key}-${ev.localDate}`,
      source_url: sourceUrl,
      title: ev.name,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      ...(image ? {
        image_url: image,
        image_credit: imageCredit(sourceUrl),
        ...(ev.imageWidth ? { image_width: ev.imageWidth, image_height: ev.imageHeight } : {}),
      } : {}),
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.name, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
