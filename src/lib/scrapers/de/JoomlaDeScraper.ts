/**
 * DE-Adapter JEvents und iCagenda (Joomla), fn-29.7: RSS der Terminliste,
 * dann je Termin die Detailseite (`joomla.ts`). Quelle ist die Detailseite
 * des Termins. Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { jeventsTermin, parseICagendaDetail, parseJEventsDetail, rssItems, type JoomlaTermin } from './joomla';
import { collapseSourceDuplicates, terminContext } from './kontext';

abstract class JoomlaDeScraper extends DeFeedScraper {
  protected abstract groups(): FeedGroup[];
  protected abstract rssUrl(g: FeedGroup): string;
  protected abstract termine(html: string, item: { title: string; link: string }): JoomlaTermin[];
  protected abstract idPrefix: string;

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.groups().slice(0, this.limit ?? Infinity);
    const today = new Date().toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();
    for (const g of groups) {
      const xml = await this.fetchFeed(this.rssUrl(g));
      if (xml == null) continue;
      const links = new Set<string>();
      const termine: JoomlaTermin[] = [];
      for (const item of rssItems(xml)) {
        let link: string;
        try { link = new URL(item.link, g.pageUrl).href; } catch { continue; }
        if (links.has(link)) continue;
        links.add(link);
        const html = await this.fetchHtmlPage(link);
        if (html == null) continue;
        termine.push(...this.termine(html, { ...item, link }).filter(t => t.localDate >= today));
      }
      const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: `${t.url}#${t.localDate}` })));
      for (const t of unique) {
        const s = this.toScraped(t, g);
        if (seen.has(s.source_id)) continue;
        seen.add(s.source_id);
        all.push(s);
      }
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(t: JoomlaTermin, g: FeedGroup): ScrapedEvent {
    const u = new URL(t.url);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `${this.idPrefix}-${u.host}-${u.pathname.replace(/\/+$/, '')}${u.search}-${t.localDate}`,
      source_url: t.url,
      title: t.title,
      start_date: t.start,
      ...(t.end ? { end_date: t.end } : {}),
      location_name: t.locationName,
      country: 'DE',
    };
    const ctx = terminContext(g, { title: t.title, locationName: t.locationName, hasOwnPlace: false });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}

export class JEventsDeScraper extends JoomlaDeScraper {
  readonly name = 'de-jevents';
  protected idPrefix = 'jev';
  protected groups() { return feedGroups('jevents'); }
  protected rssUrl(g: FeedGroup) { return g.feedUrl; }
  protected termine(html: string, item: { title: string; link: string }) {
    const t = jeventsTermin(item, parseJEventsDetail(html));
    return t ? [t] : [];
  }
}

/** Terminlisten der iCagenda-Gemeinden; ihr RSS liegt unter `?format=feed&type=rss`. */
function icagendaGroups(): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  for (const e of loadRegistryDe()) {
    if (e.integration !== 'icagenda' || !e.url) continue;
    const g = groups.get(e.url) ?? { feedUrl: e.url, pageUrl: e.url, own: [], viaVerband: [] };
    g.own.push(e);
    groups.set(e.url, g);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

export class ICagendaDeScraper extends JoomlaDeScraper {
  readonly name = 'de-icagenda';
  protected idPrefix = 'icag';
  protected groups() { return icagendaGroups(); }
  protected rssUrl(g: FeedGroup) {
    const u = new URL(g.pageUrl);
    u.searchParams.set('format', 'feed');
    u.searchParams.set('type', 'rss');
    return u.href;
  }
  protected termine(html: string, item: { link: string }) { return parseICagendaDetail(html, item.link); }
}
