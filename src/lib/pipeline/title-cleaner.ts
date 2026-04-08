// src/lib/pipeline/title-cleaner.ts
//
// Cleans dirty event titles from gem2go/gemeinden-generic sources.
// Strips concatenated category suffixes, date prefixes, visibility tags,
// and boilerplate text that scrapers accidentally include.

/**
 * Known category strings that get concatenated to titles without spaces.
 * Ordered longest-first to match greedily.
 */
const CATEGORY_SUFFIXES = [
  'Schul- und Kinderveranstaltung',
  'Veranstaltungskalender',
  'Theater, Kabarett, Show',
  'Kurs, Seminar, Tagung',
  'Gesundheit, Soziales',
  'Kirche/Religion',
  'Musik, Konzerte',
  'Sport, Freizeit',
  'Vortrag, Lesung',
  'Kulinarisches',
  'Kulturprogramm',
  'Familie & Kinder',
  'Messe, Kongress',
  'Familie, Jugend',
  'kirchliche Termine',
  'Bildung',
  'Senioren',
  'Sonstige',
  'Vereine',
  'Jugend',
  'Familie',
  'Beratung',
  'Kultur',
];

/**
 * Regex patterns for boilerplate that should be stripped from titles.
 */
const BOILERPLATE_PATTERNS = [
  // "InternÖFFENTLICH" visibility tag + everything after
  /Intern[ÖO]FFENTLICH.*/i,
  // "This is some text inside..." boilerplate
  /This is some text.*/i,
  // "News - Startseite" suffix
  /News\s*-\s*Startseite.*/i,
  // "» weiterlesen." suffix
  /»\s*weiterlesen\.?.*/i,
  // "Mehr dazu" suffix
  /Mehr\s+dazu.*/i,
];

/**
 * Date prefix pattern: "DD.MM.YYYY" at the start, optionally followed by
 * time like "HH:MM" or weekday abbreviation.
 * Only strip if there's actual title content after the date.
 */
const DATE_PREFIX_RE = /^\d{1,2}\.\d{1,2}\.\d{4}\s*/;

/**
 * Weekday+time prefix: "Mi.19:30-21:00Uhr" or "Mo.8:00-Uhr"
 */
const WEEKDAY_TIME_PREFIX_RE = /^(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?(?:-)?(?:Uhr)?\s*/;

/**
 * Repeated date+weekday+time combo: "15.4.2026Mi.8:00-Uhr" or "18.04.202610:00 Uhr"
 */
const DATE_WEEKDAY_TIME_RE = /^\d{1,2}\.\d{1,2}\.\d{4}(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\.\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?(?:-)?(?:Uhr)?|\d{1,2}:\d{2}\s*Uhr)\s*/;

/**
 * Clean a dirty event title by stripping known boilerplate patterns.
 * Returns the cleaned title, or the original if no cleaning was needed.
 */
export function cleanTitle(title: string): string {
  if (!title) return title;

  let cleaned = title.trim();

  // 1. Strip boilerplate patterns
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 2. Strip concatenated category suffixes
  // These appear without a space between the real title and the category
  // e.g. "YogaSport, Freizeit" or "KinderwortgottesdienstKirche/Religion"
  for (const cat of CATEGORY_SUFFIXES) {
    // Look for the category at the end, preceded by a word char (no space)
    const idx = cleaned.lastIndexOf(cat);
    if (idx > 0) {
      const charBefore = cleaned[idx - 1];
      // Category is concatenated if preceded by a letter/digit (not space/comma/dash)
      if (charBefore && /[\p{L}\p{N}]/u.test(charBefore)) {
        cleaned = cleaned.slice(0, idx).trim();
        break; // Only strip the first (rightmost) match
      }
      // Also strip if preceded by a comma+space (it's a category list suffix)
      // e.g. "TitleSport, Freizeit, Vereine" → after stripping "Sport" we might have trailing commas
    }
  }

  // Also handle comma-separated category lists at the end
  // e.g. title ends with ", Senioren, ..." or ", Jugend, Kinder, Familie, ..."
  cleaned = cleaned.replace(/,\s*(?:Senioren|Jugend|Kinder|Familie|Vereine|Sonstige|Bildung|Kultur)\s*(?:,\s*\.{3})?\.{0,3}\s*$/, '').trim();

  // 3. Strip date+weekday+time prefixes (only if real content follows)
  // Try the most specific first
  let afterDate = cleaned.replace(DATE_WEEKDAY_TIME_RE, '');
  if (afterDate.length < cleaned.length && afterDate.length > 3) {
    // There might be a second date+time prefix (duplicated)
    afterDate = afterDate.replace(DATE_WEEKDAY_TIME_RE, '');
    cleaned = afterDate;
  }

  // Strip simple date prefix
  const afterSimpleDate = cleaned.replace(DATE_PREFIX_RE, '');
  if (afterSimpleDate.length < cleaned.length && afterSimpleDate.length > 5) {
    // Make sure we're not stripping a title that IS just a date
    // Check if the remainder starts with a letter
    if (/^[\p{L}]/u.test(afterSimpleDate.trim())) {
      cleaned = afterSimpleDate.trim();
    }
  }

  // Strip weekday+time prefix
  const afterWeekday = cleaned.replace(WEEKDAY_TIME_PREFIX_RE, '');
  if (afterWeekday.length < cleaned.length && afterWeekday.length > 3) {
    cleaned = afterWeekday;
  }

  // 4. Strip time suffixes like "HH:MM - HH:MM Uhr" at the very end
  cleaned = cleaned.replace(/\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*Uhr\s*$/, '').trim();
  cleaned = cleaned.replace(/\s+\d{1,2}:\d{2}\s*Uhr\s*$/, '').trim();

  // 5. Clean up trailing punctuation artifacts
  cleaned = cleaned.replace(/[,;|•–—]\s*$/, '').trim();
  cleaned = cleaned.replace(/\s*,\s*\.{3}\s*$/, '').trim();

  // 6. If we cleaned to nothing or < 3 chars, return original
  if (cleaned.length < 3) return title.trim();

  return cleaned;
}

/**
 * Check if a title was modified by cleaning.
 */
export function needsCleaning(title: string): boolean {
  return cleanTitle(title) !== title.trim();
}
