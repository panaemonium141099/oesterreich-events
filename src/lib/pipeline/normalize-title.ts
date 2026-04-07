const DECORATIVE_SEPARATORS = /\s*[|•—–]+\s*/g;
const ARROWS = /\s*>{2,}\s*/g;
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
const MULTI_SPACE = /\s{2,}/g;
const PARENTHETICAL = /\s*[\(\[][^\)\]]*[\)\]]\s*/g;

const WEEKDAYS_DE =
  /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/gi;
const WEEKDAYS_EN =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

// Matches: "14. Juni", "14.06.", "14.06.2026", "14. Juni 2026"
const DATE_FRAGMENTS =
  /\b\d{1,2}\.\s*(?:jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|\d{1,2}\.?\s*(?:\d{2,4})?)\.?/gi;

const MARKETING_WORDS = /\b(official|presents?|live|event|tour|edition|special)\b/gi;

/**
 * Full normalized title: lowercase, trimmed, separators removed, emojis removed.
 * Preserves all semantic content.
 */
export function normalizeTitle(title: string): string {
  let result = title.normalize('NFC');
  result = result.toLowerCase();
  result = result.replace(EMOJI_REGEX, '');
  result = result.replace(ARROWS, ' ');
  result = result.replace(DECORATIVE_SEPARATORS, ' ');
  result = result.replace(MULTI_SPACE, ' ');
  result = result.trim();
  return result;
}

/**
 * Compact normalized title for dedup candidate search.
 * Removes parentheticals, weekdays, date fragments, marketing words.
 * NOT used as sole merge criterion.
 */
export function normalizeTitleCompact(title: string): string {
  let result = normalizeTitle(title);
  result = result.replace(PARENTHETICAL, ' ');
  result = result.replace(WEEKDAYS_DE, '');
  result = result.replace(WEEKDAYS_EN, '');
  result = result.replace(DATE_FRAGMENTS, '');
  const beforeMarketing = result;
  result = result.replace(MARKETING_WORDS, '');
  // If marketing removal would leave nothing, keep the pre-marketing content
  if (!result.replace(MULTI_SPACE, ' ').trim()) {
    result = beforeMarketing;
  }
  result = result.replace(MULTI_SPACE, ' ');
  result = result.trim();
  return result;
}
