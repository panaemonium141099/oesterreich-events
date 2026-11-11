/**
 * DE-Adapter destination.one (fn-29, Rest-Adapter): liest je Registry-
 * Seite der Integration `destinationone` die eingebettete Experience und
 * deren Termine ein Jahr ab heute über `meta.et4.de` (JSON, seitenweise).
 * Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`); die Termine
 * tragen fast immer Straße, PLZ, Gemeinde und Koordinaten, der Resolver
 * ordnet sie damit selbst zu (eine Experience ist oft die Region, nicht die
 * Gemeinde: „osnabruecker-land" auf der Seite von Bad Laer).
 *
 * Mehrere Gemeinden teilen eine Experience (Samtgemeinde Selsingen: sieben
 * Seiten, „nordwaerts-orte"): die API wird je Experience einmal gelesen.
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { ownTown } from './DesklineDeScraper';
import { isEt4Page, seitenGruppen } from './seiten-gruppen';
import { et4DetailUrl, et4Embeds, et4SearchUrl, ET4_PAGE_SIZE, parseEt4Page, type Et4Embed, type Et4Termin } from './destinationone';

/** Höchstens so viele Seiten à 500 je Experience (bersenbrueck: 3.850 Datensätze im Jahr, 07.11.2026). */
const MAX_PAGES = 10;

export class DestinationOneDeScraper extends DeFeedScraper {
  readonly name = 'de-destinationone';
  readonly integrations = ['destinationone'];
  private termine = new Map<string, Et4Termin[] | null>();

  private async events(embed: Et4Embed, from: string, to: string): Promise<Et4Termin[] | null> {
    const key = embed.experience;
    if (this.termine.has(key)) {
      this.noteCached(this.termine.get(key) != null);
      return this.termine.get(key)!;
    }
    const out: Et4Termin[] = [];
    let ok = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.fetchFeed(et4SearchUrl(key, from, to, page * ET4_PAGE_SIZE));
      if (body == null) break;
      let p;
      try {
        p = parseEt4Page(body, embed, from, to);
      } catch {
        this.log(`kein JSON: ${key} Seite ${page}`);
        break;
      }
      if (p.status !== 'OK') {
        this.log(`${key}: ${p.status}${p.message ? ` (${p.message})` : ''}`);
        break;
      }
      ok = true;
      out.push(...p.items);
      if ((page + 1) * ET4_PAGE_SIZE >= p.overallCount) break;
      if (page + 1 === MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES * ET4_PAGE_SIZE} von ${p.overallCount} Datensätzen: ${key}`);
    }
    this.termine.set(key, ok ? out : null);
    return ok ? out : null;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    // Dazu die Experience-Seiten, die die Registry unter GeoCMS führt (Saale-Unstrut,
    // fünf Gemeinden); deren Website pages.et4.de liest dieser Adapter ohnehin.
    const groups = this.pickGroups([...seitenGruppen('destinationone'), ...seitenGruppen('geocms').filter(g => isEt4Page(g.pageUrl))]);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    const firstGroupOf = new Map<string, FeedGroup>();
    let withWidget = 0;
    for (const g of groups) await this.inCalendar(g, async () => {
      const html = await this.fetchHtmlPage(g.pageUrl);
      if (html == null) return;
      const embeds = et4Embeds(html);
      if (!embeds.length) {
        this.log(`keine destination.one-Experience auf der Seite: ${g.pageUrl}`);
        return;
      }
      withWidget++;
      const termine: { t: Et4Termin; embed: Et4Embed }[] = [];
      for (const embed of embeds) {
        const first = firstGroupOf.get(embed.experience);
        if (first) {
          this.sameCalendar(g, first);
          continue;
        }
        const ev = await this.events(embed, from, to);
        if (!ev) continue;
        firstGroupOf.set(embed.experience, g);
        termine.push(...ev.map(t => ({ t, embed })));
      }
      if (!termine.length) return;
      this.noteTermine(termine.map(x => x.t));
      const byUid = new Map(termine.map(x => [x.t.uid, x.embed]));
      const unique = collapseSourceDuplicates(termine.map(x => x.t));
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g, byUid.get(t.uid)!)));
    });
    this.log(`${groups.length} Seiten, ${withWidget} mit Experience, ${firstGroupOf.size} Experiences, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: Et4Termin, g: FeedGroup, embed: Et4Embed): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const url = ev.canonical ?? et4DetailUrl(embed, ev.globalId, ev.title);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `et4-${ev.uid}`,
      source_url: url,
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
      ...(image ? {
        image_url: image,
        image_credit: ev.imageCredit ?? embed.pagesHost,
        ...(ev.imageWidth ? { image_width: ev.imageWidth, image_height: ev.imageHeight } : {}),
      } : {}),
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    // Eine Experience ist oft die Region (`osnabruecker-land` auf der Seite von Bad Laer): ein anderer Ort als die Gemeinde der Seite bekommt nicht ihren Kontext.
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) }, ownTown(g, ev));
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
