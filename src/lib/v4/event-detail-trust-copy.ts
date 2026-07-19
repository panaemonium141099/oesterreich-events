/**
 * Trust-copy strings used by V4EventDetail's ticket-bearing boxes.
 *
 * Per chat2 brief (docs/superpowers/specs/2026-05-14-v4-phase-3-…-design.md
 * §5) these are the ONLY two trust strings allowed on event detail
 * surfaces, and BANNED_STRINGS lists hard-rejected phrases that
 * mis-promised features (e.g. "Personalisierte e-Tickets") in earlier
 * iterations.
 *
 * The Vitest banned-strings snapshot in
 * src/__tests__/lib/v4/banned-strings-detail.test.tsx greps V4EventDetail
 * render output and fails if any BANNED_STRINGS entry is present.
 *
 * fn-17 (i18n): Die Komponenten rendern diese Texte inzwischen über
 * next-intl-Messages (`EventDetail.trustExternal` / `.trustRedirect` /
 * `.providerLine` / `.providerFallback` in messages/de.json — Werte dort
 * byte-identisch zu den Konstanten hier). Die Exporte bleiben als
 * kanonische Referenz + für die Tests bestehen — NICHT löschen.
 */

export const TRUST_COPY_EXTERNAL =
  'Kauf und Zahlung erfolgen beim offiziellen Anbieter.';

export const TRUST_COPY_REDIRECT =
  'Du wirst zum offiziellen Ticketshop weitergeleitet.';

export const BANNED_STRINGS: readonly string[] = [
  'Kein Aufpreis',
  'Personalisierte e-Tickets',
  'Boardkarte',
  'Bei ÖBB buchen',
];

export function providerLine(name: string | null | undefined): string {
  if (!name) return 'Offizieller Ticketshop';
  return `Offizieller Ticketshop: ${name}`;
}
