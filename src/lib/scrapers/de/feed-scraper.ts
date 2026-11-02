/**
 * Gemeinsamer Abruf der DE-Feed-Adapter (fn-29.5/6): robots.txt je Origin
 * einmal, Pause vor jedem Abruf (Crawl-delay der Website, mindestens die
 * eigene Pause aus BaseScraper), nur lesende GETs.
 *
 * Nachtlauf (fn-29.18): Jeder Abruf geht durch die Sperre je Website
 * (`host-gate.ts`), auch über Adapter hinweg. Nach dem Zeitbudget
 * (`BaseScraper.softDeadline`) ruft der Adapter nichts mehr ab und liefert
 * das bis dahin Gelesene; große Adapter setzen im nächsten Lauf hinter dem
 * zuletzt fertigen Kalender fort (`resumeGroups`, `groupDone`).
 */
import { BaseScraper } from '../BaseScraper';
import type { FetchHtmlResult } from '../fetch-html';
import { robotsAllows, robotsCrawlDelay } from '@/lib/registry-de/robots';
import { pickFeedGroups, type FeedGroup } from '@/lib/registry-de/load';
import { sharedRobotsTxt, throughHostGate } from './host-gate';

const UA_TOKEN = 'lasstreffen';

export abstract class DeFeedScraper extends BaseScraper {
  protected userAgent = 'Mozilla/5.0 (compatible; lasstreffen/1.0; +https://lasstreffen.at)';
  protected delayMs = 1000;
  /**
   * Integrationen der Registry, die der Adapter liest (`integration` bzw.
   * `fallback.integration`). Daraus folgen die Websites für die
   * Shard-Aufteilung und die Abdeckung je Integration im Bericht.
   */
  abstract readonly integrations: readonly string[];
  private budgetEnd: number | null = null;
  private budgetLogged = false;
  private cursorOrder: string[] = [];
  private cursorDone = new Set<string>();
  private cursorPrefix = 0;

  /**
   * Nur für den Prüfstand und Tests: Feeds einschränken (`limit`) bzw. nur
   * die Kalender lesen, die Gemeinden über ihr Amt oder ihre VG nutzen
   * (`onlyVerband`, Prüfstand `de-amt-vg`, fn-29.17).
   */
  constructor(protected readonly limit?: number, protected readonly onlyVerband = false) {
    super();
  }

  /** Kalender in Lesereihenfolge (`pickFeedGroups`: gleiche Kalender zusammen, Gemeinde vor Amt). */
  protected pickGroups(groups: FeedGroup[], key?: (feedUrl: string) => string): FeedGroup[] {
    return pickFeedGroups(groups, { limit: this.limit, onlyVerband: this.onlyVerband, key });
  }

  protected robotsTxt(origin: string): Promise<string | null> {
    return sharedRobotsTxt(origin, () => throughHostGate(origin, this.delayMs, async () => {
      try {
        const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': this.userAgent } });
        return res.ok ? await res.text() : null;
      } catch {
        return null;
      }
    }));
  }

  /** Zeitbudget des Laufs verbraucht (beginnt mit dem ersten Abruf). */
  protected budgetSpent(): boolean {
    this.budgetEnd ??= this.softDeadline();
    return Date.now() > this.budgetEnd;
  }

  /** Abruf durch die Sperre der Website, Pause = Crawl-delay, mindestens `delayMs`. */
  private async gated<T>(url: string, run: () => Promise<T>): Promise<T> {
    const robots = await this.robotsTxt(new URL(url).origin);
    const gap = Math.max(this.delayMs, (robotsCrawlDelay(robots, UA_TOKEN) ?? 0) * 1000);
    return throughHostGate(url, gap, run);
  }

  private budgetStop(url: string): boolean {
    if (!this.budgetSpent()) return false;
    if (!this.budgetLogged) this.log(`Zeitbudget erschöpft, keine weiteren Abrufe in diesem Lauf (zuerst ${url})`);
    this.budgetLogged = true;
    return true;
  }

  protected async fetchHtml(url: string, opts: Parameters<BaseScraper['fetchHtml']>[1] = {}): Promise<FetchHtmlResult> {
    if (this.budgetStop(url)) return { html: null, error: 'Zeitbudget erschöpft' };
    return this.gated(url, () => super.fetchHtml(url, opts));
  }

  protected async fetchPage(url: string): Promise<string> {
    if (this.budgetStop(url)) throw new Error('Zeitbudget erschöpft');
    return this.gated(url, () => super.fetchPage(url));
  }

  /** robots.txt prüfen und die Pause einhalten; false, wenn gesperrt. */
  protected async gate(url: string): Promise<boolean> {
    // Nach dem Budget keine Pause mehr: sonst wartet der Adapter je übrige URL umsonst.
    if (this.budgetStop(url)) return false;
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

  /**
   * Kalender dieses Laufs ab dem Cursor des letzten (resumeAfterCursor), mit
   * Fortschritt für `groupDone`. Schlüssel müssen in der Liste eindeutig sein.
   */
  protected resumeGroups<T>(groups: readonly T[], keyOf: (g: T) => string): T[] {
    const items = this.resumeAfterCursor(groups, keyOf);
    this.cursorOrder = items.map(keyOf);
    this.cursorDone = new Set();
    this.cursorPrefix = 0;
    return items;
  }

  /**
   * Kalender vollständig gelesen. Der Cursor rückt nur bis zum letzten
   * Kalender vor, vor dem alle fertig sind: bei parallelen Abrufen kann ein
   * späterer vor einem früheren fertig werden, der früheste offene kommt im
   * nächsten Lauf wieder dran.
   */
  protected groupDone(key: string): void {
    this.cursorDone.add(key);
    while (this.cursorPrefix < this.cursorOrder.length && this.cursorDone.has(this.cursorOrder[this.cursorPrefix])) {
      this.markReached(this.cursorOrder[this.cursorPrefix]);
      this.cursorPrefix++;
    }
  }
}
