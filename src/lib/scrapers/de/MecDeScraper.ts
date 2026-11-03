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
 * Im Nachtlauf seit fn-29.18 (`nachtlauf.ts`).
 */
import * as cheerio from 'cheerio';
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { ldEventsFromHtml, type LdEvent } from './jsonld';
import { collapseSourceDuplicates, terminContext } from './kontext';

/** Kalenderseiten aller MEC-Gemeinden, je Seite die Gemeinden, die sie führen. */
export function mecGroups(): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const add = (url: string | null, host: string | null, e: RegistryEntryDe, via: boolean) => {
    // Ohne Kalenderseite (die Registry verwirft Plugin-Dateien als URL) das MEC-Archiv.
    const page = url ?? (host ? `https://${host}/events/` : null);
    if (!page) return;
    const g = groups.get(page) ?? { feedUrl: page, pageUrl: page, own: [], viaVerband: [] };
    (via ? g.viaVerband : g.own).push(e);
    groups.set(page, g);
  };
  for (const e of loadRegistryDe()) {
    if (e.integration === 'mec') add(e.url, e.host, e, false);
    // Kalender des Amts bzw. der VG (fn-29.17).
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'mec') add(e.fallback.url, e.fallback.host, e, true);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * Die Monatsansicht wiederholt einen laufenden mehrtägigen Termin an jedem
 * angezeigten Tag, mit diesem Tag als Beginn und dem echten Ende
 * (Zella-Mehlis „Zwei Generationen" 29.10., 30.10., 31.10., 01.11., jeweils
 * bis 30.04.2027; Beginn laut Detailseite 19.09.2026), am letzten Tag auch
 * ohne Ende (Pegau „Weihnachtsmarkt & Adventsmesse" 28. bis 29.11. und
 * noch einmal 29.11., Abnahme fn-29.20). Ein Eintrag, dessen Tag ein
 * früherer Eintrag derselben Detailseite schon abdeckt, ist derselbe Termin;
 * Beginn und Ende kommen danach von der Detailseite.
 */
export function collapseRunningRepeats(events: LdEvent[]): LdEvent[] {
  const spans = new Map<string, LdEvent[]>();
  for (const e of events) {
    if (e.url && e.end && e.end.slice(0, 10) > e.localDate) spans.set(e.url, [...(spans.get(e.url) ?? []), e]);
  }
  return events.filter(e => !e.url || !(spans.get(e.url) ?? []).some(s => s !== e && s.localDate < e.localDate && s.end!.slice(0, 10) >= e.localDate));
}

/**
 * Uhrzeit, die die MEC-Detailseite anzeigt („14:00 - 18:00"). Das JSON-LD
 * derselben Seite kann eine Stunde daneben liegen: Hohen Viecheln
 * „Adventsmarkt" zeigt 14:00 bis 18:00, das JSON-LD sagt 15:00+01:00
 * (Abnahme fn-29.20). Die Anzeige ist, was der Veranstalter eingetragen hat.
 */
export function mecShownTime(html: string): { start: string; end?: string } | null {
  const $ = cheerio.load(html);
  const t = $('.mec-single-event-time .mec-events-abbr').first().text().replace(/\s+/g, ' ').trim();
  const m = /^(\d{1,2}):(\d{2})(?:\s*(?:Uhr)?\s*[-–]\s*(\d{1,2}):(\d{2}))?(?:\s*Uhr)?$/.exec(t);
  if (!m) return null;
  const hm = (h: string, min: string) => `${h.padStart(2, '0')}:${min}:00`;
  return { start: hm(m[1], m[2]), ...(m[3] ? { end: hm(m[3], m[4]) } : {}) };
}

/** Beginn und Ende eines Termins an seinem Tag nach der angezeigten Uhrzeit. */
export function withShownTime(e: LdEvent, shown: { start: string; end?: string } | null): LdEvent {
  if (!shown || e.allDay) return e;
  const endDate = e.end ? berlinDate(e.end) : e.localDate;
  if (endDate !== e.localDate) return e;
  const start = toUtcInstant(`${e.localDate}T${shown.start}`) as string;
  const end = shown.end ? (toUtcInstant(`${e.localDate}T${shown.end}`) as string) : undefined;
  return { ...e, start, end: end && end > start ? end : undefined };
}

const berlinDate = (iso: string) => (iso.length === 10 ? iso : new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }));

const termin = (e: LdEvent) => ({ uid: e.url ?? e.name, title: e.name, start: e.start, end: e.end, locationName: e.locationName, street: e.street, locality: e.locality });

export class MecDeScraper extends DeFeedScraper {
  readonly name = 'de-mec';
  readonly integrations = ['mec'];

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(mecGroups());
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
   * bekommen deshalb Datum, Ende, Bild und angezeigte Uhrzeit der Detailseite; Serien behalten
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
      const ld = html ? ldEventsFromHtml(html).find(x => x.name === e.name) : undefined;
      const d = ld && withShownTime(ld, mecShownTime(html!));
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
