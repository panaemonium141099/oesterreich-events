/**
 * DE-Adapter NOLIS (fn-29.6): liest die iCal-Exporte aller NOLIS-Kalender
 * der DE-Gemeinde-Registry, ein Jahr ab heute.
 *
 * Termine werden zwischen Kommunen eines Landkreises geteilt (dieselbe
 * Termin-ID in mehreren Portalen). Ein Termin wird einmal geschrieben, aus
 * dem Feed seiner eigenen Kommune (`X-KOMMUNE-ID` = `selected_kommune`),
 * sonst aus dem ersten Feed. Den Gemeinde-Kontext bekommt er nur aus dem
 * Feed seiner eigenen Kommune, wenn genau eine Gemeinde diesen Feed führt;
 * sonst zählt allein der Ort des Termins (Etiketten-Regel). Abgesagte
 * Termine (`STATUS:CANCELLED`) werden nicht geschrieben.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { collapseSourceDuplicates, sameTerminKey, terminContext } from './kontext';
import { completeDays, nolisDetailUrl, nolisIcsUrl, parseNolisIcs, type NolisEvent } from './nolis';


const kommuneOf = (g: FeedGroup) => new URL(g.feedUrl).searchParams.get('selected_kommune');

export class NolisDeScraper extends DeFeedScraper {
  readonly name = 'de-nolis';

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('nolis').slice(0, this.limit ?? Infinity);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const byUid = new Map<string, { ev: NolisEvent; g: FeedGroup; home: boolean }>();
    let read = 0;
    for (const g of groups) {
      const events = await this.fetchWindow(g, from, to);
      if (events == null) continue;
      for (const ev of collapseSourceDuplicates(events)) {
        read++;
        if (ev.cancelled) continue;
        const home = ev.kommuneId === kommuneOf(g);
        const cur = byUid.get(ev.uid);
        if (!cur || (home && !cur.home)) byUid.set(ev.uid, { ev, g, home });
      }
    }
    // Derselbe Termin unter zwei IDs in zwei Portalen (Delligsen und SG
    // Leinebergland, „Basketball Training"): einer, der aus dem Feed seiner
    // Kommune, sonst die kleinste ID.
    const best = new Map<string, { ev: NolisEvent; g: FeedGroup; home: boolean }>();
    for (const x of byUid.values()) {
      const k = sameTerminKey(x.ev);
      const cur = best.get(k);
      if (!cur || (x.home && !cur.home) || (x.home === cur.home && x.ev.uid < cur.ev.uid)) best.set(k, x);
    }
    const all = [...best.values()].map(({ ev, g, home }) => this.toScraped(ev, g, home));
    this.log(`${groups.length} Feeds, ${read} Termine gelesen, ${all.length} eindeutig`);
    return all;
  }

  /**
   * Ein Abruf liefert höchstens 1.000 Termine, gerechnet ab heute über
   * `auswahl_woche_tage`; ein Startdatum (`beginn`, `beginn_datum`, auch mit
   * `zeitauswahl=4`) ignoriert der Export. Gekappt wird nach Beginn sortiert
   * (Melle, Märkische Schweiz, Sachsenhagen, Visselhövede 2026-10-28: alle
   * Termine vor dem letzten Tag vollständig, 0 fehlend in 36 Vergleichen mit
   * kürzeren Abrufen). Bei voller Antwort fällt deshalb nur der letzte,
   * angeschnittene Tag weg; spätere Termine kommen in den folgenden Nächten.
   */
  private async fetchWindow(g: FeedGroup, from: string, to: string): Promise<NolisEvent[] | null> {
    const ics = await this.fetchFeed(nolisIcsUrl(g.feedUrl, from, to));
    if (ics == null) return null;
    return completeDays(parseNolisIcs(ics), (n, last) => this.log(`gekappt: ${g.feedUrl} (${n} Termine), vollständig bis vor ${last}`));
  }

  toScraped(ev: NolisEvent, g: FeedGroup, home = ev.kommuneId === kommuneOf(g)): ScrapedEvent {
    const city = ev.locality ?? ev.ort;
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `nolis-${ev.uid}`,
      source_url: nolisDetailUrl(g.feedUrl, ev),
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city,
      organizer: ev.organizer,
      category: ev.category,
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(city || ev.postalCode) }, home);
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
