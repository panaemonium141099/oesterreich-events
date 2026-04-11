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
 */
export function detectNextPage(html: string, currentUrl: string): PaginationResult {
  const $ = cheerio.load(html);

  // Strategy 1: Numbered pager with "next" or "»" link
  const nextLink = findNextLink($, currentUrl);
  if (nextLink) return { nextUrl: nextLink, type: 'next-link' };

  // Strategy 2: Numbered pagination (.pagination, .pager, .page-numbers)
  const numberedNext = findNumberedPagerNext($, currentUrl);
  if (numberedNext) return { nextUrl: numberedNext, type: 'numbered' };

  // Strategy 3: WordPress /page/N/ pattern
  const wpNext = findWPPageNext($, currentUrl);
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

          const label = new Date(year, month - 1).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
          urls.push({ url: newUrl.href, label });
        }
      }
    }
  } catch { /* invalid URL */ }

  return urls;
}

// ─── Internal Strategies ────────────────────────────────────────────────────

/**
 * Find a "next page" link by looking for common next-link patterns.
 */
function findNextLink($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Common German/English next-link selectors and text patterns
  const selectors = [
    'a.next', 'a.page-next', 'a[rel="next"]',
    'li.next a', 'li.page-next a',
    '.pagination .next a', '.pager .next a',
    '.nav-next a', '.next-page a',
  ];

  for (const sel of selectors) {
    const href = $(sel).attr('href');
    if (href && href !== '#') {
      try { return new URL(href, baseUrl).href; } catch { /* skip */ }
    }
  }

  // Text-based detection: "Nächste", "Weiter", "»", "›", "Next", ">"
  const nextTexts = ['nächste', 'weiter', '»', '›', 'next', '\\u003e', 'vor'];
  const allLinks = $('a[href]');

  for (let i = 0; i < allLinks.length; i++) {
    const el = allLinks.eq(i);
    const text = el.text().trim().toLowerCase();
    const title = (el.attr('title') || '').toLowerCase();
    const ariaLabel = (el.attr('aria-label') || '').toLowerCase();

    for (const pattern of nextTexts) {
      if (text === pattern || text.includes(pattern) || title.includes(pattern) || ariaLabel.includes(pattern)) {
        const href = el.attr('href');
        if (href && href !== '#' && !href.startsWith('javascript:')) {
          try { return new URL(href, baseUrl).href; } catch { /* skip */ }
        }
      }
    }
  }

  return null;
}

/**
 * Find the next page in a numbered pagination control.
 * Looks for the "active" page and finds the next number.
 */
function findNumberedPagerNext($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const pagerSelectors = [
    '.pagination', '.pager', '.page-numbers', '.pages',
    'nav[aria-label*="Page"]', 'nav[aria-label*="Seite"]',
    '.wp-pagenavi', '.paginierung',
  ];

  for (const containerSel of pagerSelectors) {
    const container = $(containerSel).first();
    if (container.length === 0) continue;

    // Find the active/current page
    const activePage = container.find('.active, .current, [aria-current="page"], .selected').first();
    if (activePage.length === 0) continue;

    // Get the next sibling link (handles both <a class="active"> and <span class="active">)
    const nextLink = activePage.nextAll('a').first();
    if (nextLink.length > 0) {
      const href = nextLink.attr('href');
      if (href && href !== '#') {
        try { return new URL(href, baseUrl).href; } catch { /* skip */ }
      }
    }

    // Also check if active is inside an <li> — then look at next <li>'s <a>
    if (activePage.parent().is('li')) {
      const nextLi = activePage.parent().next('li');
      const nextLiLink = nextLi.find('a').first();
      if (nextLiLink.length > 0) {
        const href = nextLiLink.attr('href');
        if (href && href !== '#') {
          try { return new URL(href, baseUrl).href; } catch { /* skip */ }
        }
      }
    }
  }

  return null;
}

/**
 * Detect WordPress /page/N/ pagination pattern.
 */
function findWPPageNext($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Look for /page/N/ links in pagination
  const pageLinks: { page: number; url: string }[] = [];
  let currentPage = 1;

  $('a[href*="/page/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const pageMatch = href.match(/\/page\/(\d+)/);
    if (pageMatch) {
      pageLinks.push({ page: parseInt(pageMatch[1]), url: href });
    }
  });

  // Detect current page from URL or active state
  const currentPageMatch = baseUrl.match(/\/page\/(\d+)/);
  if (currentPageMatch) {
    currentPage = parseInt(currentPageMatch[1]);
  }

  // Find the next page
  const nextPage = pageLinks.find((p) => p.page === currentPage + 1);
  if (nextPage) {
    try { return new URL(nextPage.url, baseUrl).href; } catch { /* skip */ }
  }

  // If we're on page 1 (no /page/ in URL) and /page/2/ exists
  if (!currentPageMatch && pageLinks.some((p) => p.page === 2)) {
    const page2 = pageLinks.find((p) => p.page === 2)!;
    try { return new URL(page2.url, baseUrl).href; } catch { /* skip */ }
  }

  return null;
}
