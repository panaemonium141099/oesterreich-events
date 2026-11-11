/**
 * DE-Adapter ILE Rhön-Grabfeld / lkrg.net (fn-29 Rest-Adapter): liest je
 * Registry-Seite der Integration `lkrg` das Kalender-Element (UUIDs des
 * Kalender-Moduls) und die Termine als JSON von der sqronline-API
 * (`lkrg.ts`). Jede Gemeinde hat ihr eigenes Modul; der Kalender zeigt die
 * Termine der Gemeinde mit „PLZ Ort", der Resolver ordnet damit zu.
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { seitenGruppen } from './seiten-gruppen';
import { ownTown } from './DesklineDeScraper';
import { lkrgEmbed, lkrgEventsUrl, parseLkrgEvents, type LkrgTermin } from './lkrg';

export class LkrgDeScraper extends DeFeedScraper {
  readonly name = 'de-lkrg';
  readonly integrations = ['lkrg'];
  private termine = new Map<string, LkrgTermin[] | null>();

  private async events(url: string, today: string): Promise<LkrgTermin[] | null> {
    if (this.termine.has(url)) {
      this.noteCached(this.termine.get(url) != null);
      return this.termine.get(url)!;
    }
    const body = await this.fetchFeed(url);
    let out: LkrgTermin[] | null = null;
    if (body != null) {
      try {
        out = parseLkrgEvents(body, today);
      } catch (e) {
        this.log(`${url}: ${e instanceof Error ? e.message : e}`);
      }
    }
    this.termine.set(url, out);
    return out;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(seitenGruppen('lkrg'));
    const today = new Date().toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    const firstGroupOf = new Map<string, FeedGroup>();
    let withWidget = 0;
    for (const g of groups) await this.inCalendar(g, async () => {
      const html = await this.fetchHtmlPage(g.pageUrl);
      if (html == null) return;
      const embed = lkrgEmbed(html);
      if (!embed) {
        this.log(`kein lkrg-Kalender auf der Seite: ${g.pageUrl}`);
        return;
      }
      withWidget++;
      const termine: LkrgTermin[] = [];
      for (const uuid of embed.uuids) {
        const url = lkrgEventsUrl(embed, uuid);
        const first = firstGroupOf.get(url);
        if (first) {
          this.sameCalendar(g, first);
          continue;
        }
        const ev = await this.events(url, today);
        if (!ev) continue;
        firstGroupOf.set(url, g);
        termine.push(...ev);
      }
      if (!termine.length) return;
      this.noteTermine(termine);
      const unique = collapseSourceDuplicates(termine);
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    });
    this.log(`${groups.length} Seiten, ${withWidget} mit Kalender, ${firstGroupOf.size} Module, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: LkrgTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `lkrg-${ev.uid}`,
      // Die API ist keine Seite; die Kalenderseite der Gemeinde zeigt den Termin.
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
      price_text: ev.priceText,
      ...(ev.ticketUrl ? { ticket_url: ev.ticketUrl } : {}),
      ...(image ? { image_url: image, image_credit: imageCredit(g.pageUrl) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) }, ownTown(g, ev));
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
