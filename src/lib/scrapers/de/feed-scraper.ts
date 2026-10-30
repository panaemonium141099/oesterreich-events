/**
 * Gemeinsamer Abruf der DE-Feed-Adapter (fn-29.5/6): robots.txt je Origin
 * einmal, Pause vor jedem Abruf (Crawl-delay der Website, mindestens die
 * eigene Pause aus BaseScraper), nur lesende GETs.
 */
import { BaseScraper } from '../BaseScraper';
import { robotsAllows, robotsCrawlDelay } from '@/lib/registry-de/robots';

const UA_TOKEN = 'lasstreffen';

export abstract class DeFeedScraper extends BaseScraper {
  protected userAgent = 'Mozilla/5.0 (compatible; lasstreffen/1.0; +https://lasstreffen.at)';
  protected delayMs = 1000;
  private robots = new Map<string, string | null>();

  /** Nur für den Prüfstand und Tests: Feeds einschränken. */
  constructor(protected readonly limit?: number) {
    super();
  }

  protected async robotsTxt(origin: string): Promise<string | null> {
    if (this.robots.has(origin)) return this.robots.get(origin)!;
    let txt: string | null = null;
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': this.userAgent } });
      txt = res.ok ? await res.text() : null;
    } catch {
      txt = null;
    }
    this.robots.set(origin, txt);
    return txt;
  }

  /** robots.txt prüfen und die Pause einhalten; false, wenn gesperrt. */
  private async gate(url: string): Promise<boolean> {
    const robots = await this.robotsTxt(new URL(url).origin);
    if (!robotsAllows(robots, url, UA_TOKEN)) {
      this.log(`robots.txt sperrt ${url}`);
      return false;
    }
    await this.sleep(Math.max(this.delayMs, (robotsCrawlDelay(robots, UA_TOKEN) ?? 0) * 1000));
    return true;
  }

  /** HTML-Seite über `BaseScraper.fetchHtml` (nur HTML, Größengrenze), wenn robots.txt sie erlaubt. */
  protected async fetchHtmlPage(url: string): Promise<string | null> {
    if (!(await this.gate(url))) return null;
    const { html } = await this.fetchHtml(url);
    if (html == null) this.log(`nicht lesbar: ${url}`);
    return html;
  }

  /** Feed lesen, wenn robots.txt ihn erlaubt; sonst null (mit Logeintrag). */
  protected async fetchFeed(url: string): Promise<string | null> {
    if (!(await this.gate(url))) return null;
    try {
      return await this.fetchPage(url);
    } catch (e) {
      this.log(`nicht lesbar: ${url}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}
