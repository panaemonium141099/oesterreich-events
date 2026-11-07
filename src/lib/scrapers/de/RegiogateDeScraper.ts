/**
 * DE-Adapter recon CMS / regiogate (fn-29 Rest-Adapter): liest je
 * Registry-Seite der Integration `regiogate` die Karten der Kalenderseite
 * und je Termin die Detailseite (Adresse mit PLZ; das Jahr fehlt in der
 * Liste). Websites mit anderer Listenvorlage (Kronach `events-list-link`,
 * Würzburg eigene Terminsuche) melden „keine Terminkarten".
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
import { isRegiogatePage, parseRegiogateDetail, parseRegiogateList, toRegiogateTermin, type RegiogateTermin } from './regiogate';

/** Höchstens so viele Detailseiten je Kalender (Bad Kissingen zeigt 24 Karten). */
const MAX_DETAILS = 60;

export class RegiogateDeScraper extends DeFeedScraper {
  readonly name = 'de-regiogate';
  readonly integrations = ['regiogate'];
  private details = new Map<string, ReturnType<typeof parseRegiogateDetail>>();

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(seitenGruppen('regiogate'));
    const today = new Date().toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    let withCards = 0;
    for (const g of groups) await this.inCalendar(g, async () => {
      const html = await this.fetchHtmlPage(g.pageUrl);
      if (html == null) return;
      const cards = parseRegiogateList(html, g.pageUrl);
      if (!cards.length) {
        this.log(`${isRegiogatePage(html) ? 'keine Terminkarten' : 'kein recon CMS'} auf der Seite: ${g.pageUrl}`);
        return;
      }
      withCards++;
      const termine: RegiogateTermin[] = [];
      for (const card of cards.slice(0, MAX_DETAILS)) {
        let detail = this.details.get(card.url);
        if (detail === undefined) {
          const page = await this.fetchHtmlPage(card.url);
          detail = page ? parseRegiogateDetail(page, card.url) : null;
          this.details.set(card.url, detail);
        } else this.noteCached(detail != null);
        const t = toRegiogateTermin(card, detail, today);
        if (t) termine.push(t);
      }
      if (cards.length > MAX_DETAILS) this.log(`abgeschnitten nach ${MAX_DETAILS} von ${cards.length} Karten: ${g.pageUrl}`);
      this.noteTermine(termine);
      const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: t.id })));
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    });
    this.log(`${groups.length} Seiten, ${withCards} mit Terminkarten, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: RegiogateTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image, ev.url);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `regiogate-${new URL(ev.url).host}-${ev.id}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) }, ownTown(g, ev));
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
