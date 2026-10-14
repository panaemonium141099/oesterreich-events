/**
 * Shared pagination utility for municipality scrapers.
 *
 * Detects common pagination patterns on Austrian municipality websites:
 * - Numbered pagers (.pager, .pagination, .page-numbers, nav.pages)
 * - "Nächste"/"Weiter"/"»" next-page links
 * - WordPress /page/N/ URLs
 * - ?page=N, ?seite=N, ?p=N query parameters
 * - Month navigation (kalender?monat=YYYY-MM)
 */

import * as cheerio from 'cheerio';
import { EVENT_TZ } from '@/lib/utils/event-time';

export interface PaginationResult {
  /** Next page URL (absolute), or null if no more pages */
  nextUrl: string | null;
  /** Pagination type that was detected */
  type: 'numbered' | 'next-link' | 'wp-page' | 'month-nav' | 'none';
}

export interface MonthPageUrl {
  url: string;
  label: string; // e.g. "Mai 2026"
}

/**
 * Maximum pages to follow per municipality to prevent infinite loops
 */
export const MAX_PAGES_PER_SITE = 6;

/**
 * Maximum months forward to scrape (for month-based calendars)
 */
export const MAX_MONTHS_FORWARD = 4;

/**
 * Detect the next page URL from the current HTML.
 * Tries multiple strategies in order of reliability.
 *
 * Jeder Kandidat muss eine Folgeseite sein können (`followableUrl`):
 * dieselbe Website, keine Datei, nicht die aktuelle Seite. Bis 2026-10
 * genügte ein Teilwort im Linktext ("vor" in "Voranschlag 2026"), und
 * Strobl lieferte so ein 77,7-MB-PDF als "Seite 2" (GetDocument.ashx).
 * Stichprobe 2026-10: von 246 erkannten Folgeseiten waren 109 Menüpunkte,
 * Rückwärtslinks ("Vorige Seite", "Vorherige Veranstaltungen") oder die
 * Seite selbst.
 */
export function detectNextPage(html: string, currentUrl: string): PaginationResult {
  const $ = cheerio.load(html);
  const ctx: LinkContext = { $, baseUrl: currentUrl, hosts: ownHosts($, currentUrl), containers: pagerContainers($) };

  // Strategy 1: Pager-Container (.pagination, .pager, nav[aria-label*=Seite], …):
  // Weiter-Link, sonst die Zahl nach der aktuellen Seite. Gibt der Pager
  // nichts her, ist das die letzte Seite.
  const pagerNext = findPagerContainerNext(ctx);
  if (pagerNext) return pagerNext;

  // Strategy 2: "next" classes / rel=next / whole-word next labels outside pagers
  const nextLink = findNextLink(ctx);
  if (nextLink) return { nextUrl: nextLink, type: 'next-link' };

  // Strategy 3: WordPress /page/N/ pattern
  const wpNext = findWPPageNext(ctx);
  if (wpNext) return { nextUrl: wpNext, type: 'wp-page' };

  return { nextUrl: null, type: 'none' };
}

/**
 * Detect month-based calendar navigation and return URLs for upcoming months.
 * Many Gemeinde sites have a month calendar with navigation arrows.
 */
export function detectMonthNavigation(html: string, currentUrl: string): MonthPageUrl[] {
  const $ = cheerio.load(html);
  const months: MonthPageUrl[] = [];
  const seen = new Set<string>();

  // Look for month navigation links
  // Common patterns: ?monat=2026-05, ?month=5&year=2026, /kalender/2026/05
  const monthPatterns = [
    // Query param based
    /[?&](monat|month|datum|date)=(\d{4}[-/]\d{1,2})/i,
    /[?&](monat|month)=(\d{1,2})[&]year=(\d{4})/i,
    // Path based
    /\/kalender\/(\d{4})\/(\d{1,2})/,
    /\/veranstaltungen\/(\d{4})\/(\d{1,2})/,
    /\/events\/(\d{4})\/(\d{1,2})/,
    /\/termine\/(\d{4})\/(\d{1,2})/,
  ];

  // Find all links that look like month navigation
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const text = $(el).text().trim();

    for (const pattern of monthPatterns) {
      if (pattern.test(href)) {
        try {
          const absUrl = new URL(href, currentUrl).href;
          if (!seen.has(absUrl)) {
            seen.add(absUrl);
            months.push({ url: absUrl, label: text || href });
          }
        } catch { /* invalid URL */ }
        break;
      }
    }
  });

  // Also look for "next month" arrow links (» / › / Nächster Monat / →)
  const nextMonthSelectors = [
    'a.fc-next-button', 'a.next-month', '.calendar-nav a:last-child',
    '.month-nav a:last-child', '.kalender-nav a:last-child',
  ];

  for (const selector of nextMonthSelectors) {
    const el = $(selector);
    const href = el.attr('href');
    if (href) {
      try {
        const absUrl = new URL(href, currentUrl).href;
        if (!seen.has(absUrl)) {
          seen.add(absUrl);
          months.push({ url: absUrl, label: el.text().trim() || 'next month' });
        }
      } catch { /* skip */ }
    }
  }

  // If no explicit month links found, try to construct month URLs from current URL
  if (months.length === 0) {
    const futureMonthUrls = buildFutureMonthUrls(currentUrl);
    months.push(...futureMonthUrls);
  }

  return months;
}

/**
 * Build future month URLs by analyzing the current URL pattern.
 * If the URL contains a date/month parameter, generate URLs for upcoming months.
 */
function buildFutureMonthUrls(currentUrl: string): MonthPageUrl[] {
  const urls: MonthPageUrl[] = [];
  const now = new Date();

  try {
    const parsed = new URL(currentUrl);
    const params = parsed.searchParams;

    // Check for common month params
    const monthParam = params.get('monat') || params.get('month') || params.get('datum');
    if (monthParam) {
      // Try to parse the current month value and generate future months
      const dateMatch = monthParam.match(/(\d{4})[-/](\d{1,2})/);
      if (dateMatch) {
        const baseYear = parseInt(dateMatch[1]);
        const baseMonth = parseInt(dateMatch[2]);
        const paramName = params.has('monat') ? 'monat' : params.has('month') ? 'month' : 'datum';

        for (let i = 1; i <= MAX_MONTHS_FORWARD; i++) {
          const targetMonth = baseMonth + i;
          const year = baseYear + Math.floor((targetMonth - 1) / 12);
          const month = ((targetMonth - 1) % 12) + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;

          const newUrl = new URL(currentUrl);
          newUrl.searchParams.set(paramName, monthStr);

          const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('de-AT', { month: 'long', year: 'numeric', timeZone: EVENT_TZ });
          urls.push({ url: newUrl.href, label });
        }
      }
    }
  } catch { /* invalid URL */ }

  return urls;
}

// ─── Folgeseiten-Prüfung ────────────────────────────────────────────────────

interface LinkContext {
  $: cheerio.CheerioAPI;
  baseUrl: string;
  /** Hosts dieser Website (ohne "www."): aktuelle URL, canonical, og:url */
  hosts: Set<string>;
  /** Pager-Container der Seite (pagerContainers) */
  containers: cheerio.Cheerio<any>[];
}

/** Dateiendungen, hinter denen nie eine Folgeseite steckt. */
const FILE_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|od[tsp]|rtf|txt|csv|zip|rar|7z|gz|jpe?g|png|gif|webp|svg|bmp|tiff?|mp3|mp4|m4a|wav|avi|mov|wmv|ics|vcs|vcf|xml|rss|json|exe|apk)$/i;

/** Datei-Ausgaben ohne Endung: RiS/GEM2GO GetDocument.ashx, TYPO3 fileadmin, /download/… */
const FILE_HANDLER = /\.ashx$|\/(fileadmin|download|downloads)\/|\/(getdocument|getfile|download)$/i;

const stripWww = (host: string) => host.toLowerCase().replace(/^www\./, '');

/**
 * Hosts, unter denen die Seite selbst erreichbar ist. Gemeinden laufen oft
 * unter zwei Domains (trausdorf-wulka.gv.at listet seine Seiten absolut
 * unter trausdorf-wulka.at), die Seite nennt ihre eigene im canonical/og:url.
 */
function ownHosts($: cheerio.CheerioAPI, baseUrl: string): Set<string> {
  const hosts = new Set<string>();
  const add = (url: string | undefined) => {
    if (!url) return;
    try { hosts.add(stripWww(new URL(url, baseUrl).host)); } catch { /* skip */ }
  };
  add(baseUrl);
  add($('link[rel="canonical"]').attr('href'));
  add($('meta[property="og:url"]').attr('content'));
  return hosts;
}

const withoutHash = (url: URL) => url.href.replace(/#.*$/, '');

/**
 * Absolute URL des Links, wenn er eine Folgeseite derselben Website sein
 * kann: http(s), eigener Host, kein Download-Link, keine Datei, nicht die
 * aktuelle Seite. Sonst null.
 */
function followableUrl(ctx: LinkContext, el: cheerio.Cheerio<any>): string | null {
  const href = el.attr('href')?.trim();
  if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return null;
  if (el.attr('download') !== undefined || /download/i.test(el.attr('class') ?? '')) return null;

  let url: URL;
  try { url = new URL(href, ctx.baseUrl); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!ctx.hosts.has(stripWww(url.host))) return null;
  if (FILE_EXTENSION.test(url.pathname) || FILE_HANDLER.test(url.pathname)) return null;
  if (url.searchParams.has('download')) return null;
  try {
    if (withoutHash(url) === withoutHash(new URL(ctx.baseUrl))) return null;
  } catch { /* baseUrl ungültig: nichts zu vergleichen */ }
  return url.href;
}

// ─── Weiter-Beschriftungen ──────────────────────────────────────────────────

/** Wörter, die einen Weiter-Link tragen ("vor" nur als ganzes Wort: "zurück | vor"). */
const NEXT_WORDS = new Set([
  'nächste', 'nächster', 'nächstes', 'nächsten', 'weiter', 'vor', 'vorwärts',
  'später', 'spätere', 'späteren', 'next',
]);
const NEXT_ARROWS = new Set(['»', '›', '>', '>>', '»»', '››', '→', '❯', '▶', '►']);
/**
 * Füllwörter neben einem Weiter-Wort ("Nächste Seite", "Weiter zur nächsten
 * Seite"). Nur Mehrzahl: "Nächste Veranstaltung" ist eine Überschrift über
 * dem kommenden Termin, keine Folgeseite (Kirchstetten 2026-10).
 */
const LABEL_FILLERS = new Set([
  'seite', 'page', 'zur', 'zum', 'zu', 'der', 'die', 'den',
  'veranstaltungen', 'termine', 'events', 'einträge', 'beiträge', 'ergebnisse',
  'monat', 'woche', 'tag',
]);
const ARROWS_ONLY = /^[\s«‹<>»›|→←❮❯▶►◀◄]*$/;

/**
 * Ist die Beschriftung ein Weiter-Link? Ganze Wörter statt Teilwörter: die
 * Beschriftung besteht nur aus Weiter-Wörtern, Pfeilen und Füllwörtern, und
 * stehen Wörter darin, ist eines ein Weiter-Wort. "Voranschlag",
 * "Gemeindevorstand", "Weitere Informationen", "Vorige Seite", ">|" (letzte
 * Seite) und der Menüpunkt "Veranstaltungen ›" sind es nicht.
 */
export function isNextLabel(label: string): boolean {
  const tokens = label.toLowerCase()
    .replace(/([«‹<>»›→❯▶►|]+)/g, ' $1 ')
    .replace(/[.,:;!?()[\]"'„“”…\-–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let nextWord = false;
  let arrow = false;
  let filler = false;
  for (const token of tokens) {
    if (NEXT_WORDS.has(token)) nextWord = true;
    else if (NEXT_ARROWS.has(token)) arrow = true;
    else if (LABEL_FILLERS.has(token)) filler = true;
    else return false;
  }
  return nextWord || (arrow && !filler);
}

/**
 * Weiter-Link nach seiner Beschriftung. Der sichtbare Text entscheidet;
 * bei reinen Pfeilen ("›", "»") gehen title/aria-label vor, denn "»" heißt
 * in manchen Pagern "Letzte Seite".
 */
function hasNextLabel(el: cheerio.Cheerio<any>): boolean {
  const text = el.text().replace(/\s+/g, ' ').trim();
  if (!ARROWS_ONLY.test(text)) return isNextLabel(text);
  const described = [el.attr('aria-label'), el.attr('title')].filter((s): s is string => !!s?.trim());
  if (described.length > 0) return described.some(isNextLabel);
  return isNextLabel(text);
}

/** Klasse eines Weiter-Links: a.next, li.next > a, tribe "…__next", "…--next", wp-pagenavi. */
const NEXT_CLASS = /(^|[\s_-])next($|[\s_-])|nextpostslink/i;

function hasNextClass(el: cheerio.Cheerio<any>): boolean {
  return NEXT_CLASS.test(el.attr('class') ?? '') || (el.parent().is('li') && NEXT_CLASS.test(el.parent().attr('class') ?? ''));
}

// ─── Internal Strategies ────────────────────────────────────────────────────

const PAGER_CONTAINERS = [
  '.pagination', '.pager', '.page-numbers', '.pages', '.wp-pagenavi', '.paginierung',
  '[class*="pagination"]', '[class*="pager"]', '[class*="pagebrowse"]',
  'nav[aria-label*="seite" i]', 'nav[aria-label*="page" i]', 'nav[aria-label*="paginierung" i]',
].join(', ');

/** Pager-Container der Seite; bei Pagern ohne Container-Klasse (RiS: p > a.pager) das Elternelement der Seitenlinks. */
function pagerContainers($: cheerio.CheerioAPI): cheerio.Cheerio<any>[] {
  const seen = new Set<unknown>();
  const out: cheerio.Cheerio<any>[] = [];
  const add = (node: any) => {
    if (seen.has(node)) return;
    seen.add(node);
    out.push($(node));
  };
  $(PAGER_CONTAINERS).not('a').each((_, node) => add(node));
  $('a.pager, a.page-numbers, a.page-link').each((_, node) => {
    const parent = $(node).parent();
    const container = parent.is('li') ? parent.parent() : parent;
    if (container.length > 0) add(container[0]);
  });
  return out;
}

/** Markierung der aktuellen Seite im Pager. */
const ACTIVE_PAGE = '.active, .current, [aria-current="page"], .selected, .pager_sel';

/**
 * Im Pager-Container: zuerst ein Weiter-Link (Beschriftung oder Klasse),
 * sonst die nächste Seitenzahl nach der aktuellen Seite.
 */
function findPagerContainerNext(ctx: LinkContext): PaginationResult | null {
  const { containers } = ctx;

  for (const container of containers) {
    const links = container.find('a[href]');
    for (let i = 0; i < links.length; i++) {
      const el = links.eq(i);
      if (!hasNextLabel(el) && !hasNextClass(el)) continue;
      const url = followableUrl(ctx, el);
      if (url) return { nextUrl: url, type: 'next-link' };
    }
  }

  for (const container of containers) {
    const url = findNumberedPagerNext(ctx, container);
    if (url) return { nextUrl: url, type: 'numbered' };
  }
  return null;
}

/**
 * Find the next page in a numbered pagination control.
 * Looks for the "active" page and takes the following page number.
 */
function findNumberedPagerNext(ctx: LinkContext, container: cheerio.Cheerio<any>): string | null {
  const activePage = container.find(ACTIVE_PAGE).first();
  if (activePage.length === 0) return null;

  // Next sibling link (handles both <a class="active"> and <span class="active">),
  // or — if the active page sits inside an <li> — the next <li>'s link
  const candidates = [activePage.nextAll('a').first()];
  const activeItem = activePage.is('li') ? activePage : activePage.parent().is('li') ? activePage.parent() : null;
  if (activeItem) candidates.push(activeItem.next('li').find('a').first());

  for (const el of candidates) {
    if (el.length === 0) continue;
    // Seitenzahl oder Weiter-Pfeil, kein Reiter wie "Beiträge"
    const text = el.text().replace(/\s+/g, ' ').trim();
    if (!/^\d+$/.test(text) && !hasNextLabel(el)) continue;
    const url = followableUrl(ctx, el);
    if (url) return url;
  }
  return null;
}

/**
 * Find a "next page" link outside pager containers: next classes, rel=next,
 * then whole-word next labels anywhere on the page. Links in Pager-Containern
 * hat Strategie 1 schon gewertet: RiS setzt rel="Next" auch auf "Seite 1",
 * auf der letzten Seite führte das zurück an den Anfang (Hainfeld 2026-10).
 * Außerhalb eines Pagers muss das Ziel wie eine weitere Seite der Liste
 * aussehen, sonst ist "Nächste Veranstaltung" ein Link auf den Kalender.
 */
function findNextLink(ctx: LinkContext): string | null {
  const { $ } = ctx;
  const inPager = new Set<unknown>();
  for (const container of ctx.containers) {
    container.find('a').each((_, node) => { inPager.add(node); });
  }
  const candidate = (el: cheerio.Cheerio<any>): string | null => {
    if (inPager.has(el[0])) return null;
    const url = followableUrl(ctx, el);
    return url && looksLikePageOf(url, ctx.baseUrl) ? url : null;
  };

  const selectors = [
    'a.next', 'a.page-next', 'a[rel~="next"]',
    'li.next a', 'li.page-next a',
    '.nav-next a', '.next-page a',
  ];

  for (const sel of selectors) {
    const links = $(sel);
    for (let i = 0; i < links.length; i++) {
      const el = links.eq(i);
      if (isBackLabel(el)) continue;
      const url = candidate(el);
      if (url) return url;
    }
  }

  // Text-based detection: "Nächste", "Weiter", "»", "›", "Next", ">" als ganze Wörter
  const allLinks = $('a[href]');
  for (let i = 0; i < allLinks.length; i++) {
    const el = allLinks.eq(i);
    if (!hasNextLabel(el)) continue;
    const url = candidate(el);
    if (url) return url;
  }

  return null;
}

/** Seitenangabe in Pfad oder Query: /seite/2/, /page-2, ?page=2, ?pno=2, tribe_paged=2, [currentPage]=2, ?start=10 */
const PAGE_PARAM = /(^|[/?&;_\-[])(page|seite|pno|paged|pg|p|offset|start|currentpage|pointer)\]?[=/_-]?\d+/i;

/** Gleicher Pfad wie die aktuelle Seite (andere Query) oder eine Seitenangabe in der URL. */
function looksLikePageOf(url: string, baseUrl: string): boolean {
  const next = new URL(url);
  let base: URL;
  try { base = new URL(baseUrl); } catch { return false; }
  const path = (u: URL) => u.pathname.toLowerCase().replace(/\/+$/, '');
  if (path(next) === path(base)) return true;
  let pathAndQuery = next.pathname + next.search;
  try { pathAndQuery = decodeURIComponent(pathAndQuery); } catch { /* roh prüfen */ }
  return PAGE_PARAM.test(pathAndQuery);
}

/** Rückwärts-Beschriftung am Anfang: "«", "<", "|<", "Erste", "Vorige", "Zurück", "Previous" */
const BACK_LABEL = /^(«|‹|<|\|\s*<|erste|vorige|vorherige|zurück|previous|prev|first)(?![a-zäöüß])/i;

function isBackLabel(el: cheerio.Cheerio<any>): boolean {
  const labels = [el.text(), el.attr('title') ?? '', el.attr('aria-label') ?? ''];
  return labels.some(l => BACK_LABEL.test(l.replace(/\s+/g, ' ').trim()));
}

/**
 * Detect WordPress /page/N/ pagination pattern.
 */
function findWPPageNext(ctx: LinkContext): string | null {
  const { $, baseUrl } = ctx;
  // Look for /page/N/ links in pagination
  const pageLinks: { page: number; url: string }[] = [];
  let currentPage = 1;

  $('a[href*="/page/"]').each((_, el) => {
    const url = followableUrl(ctx, $(el));
    if (!url) return;
    const pageMatch = new URL(url).pathname.match(/\/page\/(\d+)/);
    if (pageMatch) {
      pageLinks.push({ page: parseInt(pageMatch[1]), url });
    }
  });

  // Detect current page from URL or active state
  const currentPageMatch = baseUrl.match(/\/page\/(\d+)/);
  if (currentPageMatch) {
    currentPage = parseInt(currentPageMatch[1]);
  }

  // Find the next page
  const nextPage = pageLinks.find((p) => p.page === currentPage + 1);
  if (nextPage) return nextPage.url;

  // If we're on page 1 (no /page/ in URL) and /page/2/ exists
  if (!currentPageMatch) {
    const page2 = pageLinks.find((p) => p.page === 2);
    if (page2) return page2.url;
  }

  return null;
}
