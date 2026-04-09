/**
 * Student relevance scoring for events.
 *
 * Computes a score (0-100) indicating how relevant an event is for students.
 * Used by both student-data.ts (server render) and the Events API (?studentScore=true)
 * to ensure pagination parity.
 */

/** Minimum student score to appear on student pages */
export const MIN_STUDENT_SCORE = 15;

/** Student-related keywords (matched against lowercased title) */
const STUDENT_KEYWORDS = [
  'student',
  'uni ',
  'campus',
  'esn',
  'pub quiz',
  'oeh',
  'hochschul',
  'erasmus',
  'semester',
  'mensa',
  'fachschaft',
  'htu',
  'audimax',
  'vorlesung',
  'workshop',
];

/** Categories with inherent student affinity */
const STUDENT_CATEGORIES: Record<string, number> = {
  Nightlife: 20,
  Bildung: 15,
};

/** Day-of-week bonus: Thu=4, Fri=5, Sat=6 (Vienna timezone) */
const GOING_OUT_DAYS = new Set([4, 5, 6]);

/**
 * Computes student relevance score for an event (0-100, clamped).
 *
 * Signals:
 *   +30  Title contains student keywords
 *   +20  Category = Nightlife
 *   +15  Category = Bildung
 *   +10  Price is free or < 10 EUR (only when price is known)
 *   +10  Day of week is Thu/Fri/Sat
 *   +5   Start time >= 20:00
 *   +10  Venue is student-relevant (for future venue-matching)
 */
export function computeStudentScore(
  event: {
    title: string;
    category: string | null;
    price_min: number | null;
    price_text: string | null;
    start_date: string;
  },
  venueStudentRelevant?: boolean,
): number {
  let score = 0;

  // 1. Title keywords (+30)
  const titleLower = event.title.toLowerCase();
  if (STUDENT_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    score += 30;
  }

  // 2. Category affinity (+15 or +20)
  if (event.category && event.category in STUDENT_CATEGORIES) {
    score += STUDENT_CATEGORIES[event.category];
  }

  // 3. Price: free or cheap — only when price is KNOWN (+10)
  if (event.price_min !== null && event.price_min !== undefined) {
    if (event.price_min === 0 || event.price_min < 10) {
      score += 10;
    }
  } else if (event.price_text) {
    const ptLower = event.price_text.toLowerCase();
    if (
      ptLower.includes('gratis') ||
      ptLower.includes('kostenlos') ||
      ptLower.includes('free') ||
      ptLower.includes('frei') ||
      ptLower.includes('eintritt frei')
    ) {
      score += 10;
    }
  }

  // 4. Day of week: Thu/Fri/Sat (+10)
  try {
    const eventDate = new Date(event.start_date);
    // Get day in Vienna timezone
    const viennaDay = new Date(
      eventDate.toLocaleString('en-US', { timeZone: 'Europe/Vienna' }),
    ).getDay();
    if (GOING_OUT_DAYS.has(viennaDay)) {
      score += 10;
    }

    // 5. Evening: start >= 20:00 (+5)
    const viennaHour = new Date(
      eventDate.toLocaleString('en-US', { timeZone: 'Europe/Vienna' }),
    ).getHours();
    if (viennaHour >= 20) {
      score += 5;
    }
  } catch {
    // Invalid date — skip time-based scoring
  }

  // 6. Venue student-relevant flag (+10)
  if (venueStudentRelevant) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Checks if an event has a known free price.
 * Used by the ?freeOnly=true API filter.
 * Explicitly excludes events with unknown price (NULL) — unknown is not free.
 */
export function isFreeEvent(event: {
  price_min: number | null;
  price_text: string | null;
}): boolean {
  // Explicit price_min = 0
  if (event.price_min === 0) return true;

  // Price text contains free keywords
  if (event.price_text) {
    const ptLower = event.price_text.toLowerCase();
    return (
      ptLower.includes('gratis') ||
      ptLower.includes('kostenlos') ||
      ptLower.includes('free') ||
      ptLower.includes('frei') ||
      ptLower.includes('eintritt frei')
    );
  }

  // Unknown price — NOT free
  return false;
}
