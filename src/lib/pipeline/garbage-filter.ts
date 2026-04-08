// src/lib/pipeline/garbage-filter.ts

/**
 * Garbage title filter — identifies non-event pages that scrapers accidentally pick up.
 * These get publish_status = 'suppressed' + flag 'garbage_title' before any dedup.
 */

const GARBAGE_TITLES = new Set([
  'oeffnungszeiten', 'offnungszeiten', 'öffnungszeiten', 'opening hours',
  'kontakt', 'contact', 'impressum', 'imprint',
  'datenschutz', 'datenschutzerklärung', 'datenschutzerklaerung', 'privacy', 'privacy policy',
  'agb', 'allgemeine geschäftsbedingungen', 'terms',
  'startseite', 'home', 'homepage', 'willkommen', 'welcome',
  'ueber uns', 'über uns', 'about', 'about us',
  'newsletter', 'anmeldung', 'registrierung', 'registration', 'sign up',
  'suche', 'search', 'sitemap', 'login', 'anmelden',
  'warenkorb', 'cart', 'checkout', 'zahlung', 'payment',
  'cookie', 'cookies', 'cookie einstellungen',
  'archiv', 'archive', 'kalender', 'calendar',
  'unterkünfte', 'unterkuenfte', 'accommodation',
  'anfahrt', 'directions', 'lageplan',
  'galerie', 'gallery', 'fotos', 'photos',
  'downloads', 'presse', 'press',
  'faq', 'hilfe', 'help',
  'jobs', 'karriere', 'career',
  'sponsoren', 'sponsors', 'partner',
  'mehr informationen', 'more information',
  'weitere informationen', 'details',
]);

/**
 * Check if a title (after normalization/lowercasing) is a garbage non-event page.
 */
export function isGarbageTitle(title: string): boolean {
  const normalized = title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Exact match against blacklist
  if (GARBAGE_TITLES.has(normalized)) return true;

  // Too short (< 3 chars after normalization)
  if (normalized.length < 3) return true;

  // Date-only titles: "15.04.2026 15:00 - 17:00 Uhr", "Mi.19:30-21:00Uhr", etc.
  // After normalization these become mostly digits+spaces — not real event titles.
  const withoutDigitsAndSpaces = normalized.replace(/[\d\s]/g, '');
  if (withoutDigitsAndSpaces.length < 4 && normalized.length > 5) return true;

  // Titles that are just "DD.MM.YYYY" or "DD Mon" patterns
  if (/^\d{1,2}\s+\w{3,4}\s*$/.test(normalized)) return true;

  // Time-only titles: "00:00", "18:00", "Mi.19:30-21:00Uhr", "10:00 Uhr", etc.
  // After normalization these are mostly digits, colons, weekday abbreviations.
  const timeOnly = title.trim().replace(/[\s.,:;\-]/g, '').replace(/Uhr/gi, '');
  const timeLetters = timeOnly.replace(/[\d]/g, '');
  // If what remains is just a 2-letter weekday abbreviation (or empty), it's a time-only title
  if (timeOnly.length >= 3 && timeOnly.length <= 20 &&
      (timeLetters.length === 0 || /^(?:Mo|Di|Mi|Do|Fr|Sa|So)$/i.test(timeLetters))) {
    return true;
  }

  return false;
}

/**
 * Get all garbage titles for testing/admin display.
 */
export function getGarbageTitles(): ReadonlySet<string> {
  return GARBAGE_TITLES;
}
