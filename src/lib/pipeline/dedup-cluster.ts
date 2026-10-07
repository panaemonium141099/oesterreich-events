// src/lib/pipeline/dedup-cluster.ts

/**
 * Primary-Wahl und Feld-Anreicherung für Dedup-Cluster. Die Cluster selbst
 * bildet dedup-engine.ts (mit Mehrdeutigkeits- und Widerspruchsschutz).
 */

import type { EventRow } from './types';

const DATE_WORDS = /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so|januar|jaenner|jänner|februar|maerz|märz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sep|sept|okt|nov|dez|uhr|ab|bis)\b/gi;

/** Titel, der nach Abzug von Datum, Wochentag, Uhrzeit und Satzzeichen leer ist. */
export function isDateOnlyTitle(title: string | null | undefined): boolean {
  const rest = (title ?? '').toLowerCase().replace(DATE_WORDS, ' ').replace(/[^\p{L}]+/gu, '');
  return rest.length === 0;
}

// ---------------------------------------------------------------------------
// Primary selection
// ---------------------------------------------------------------------------

/**
 * Select the best event as primary from a cluster.
 *
 * Criteria (in order):
 * 1. Sichtbar (nicht needs_review/suppressed)
 * 2. Von der Quelle noch geliefert (nicht verwaist)
 * 3. Eventim (Affiliate-Ticketlink)
 * 4. Bisheriger Primary (stabile URL)
 * 5. Highest quality_score
 * 6. Longest meaningful description (> 50 chars)
 * 7. Has image_url
 * 8. Has ticket_url
 * 9. Oldest created_at
 */
export function selectPrimary(events: EventRow[], isOrphan: (id: string) => boolean = () => false): EventRow {
  // Bisheriger Primary: auf ihn zeigt ein anderes Mitglied, er selbst ist
  // kein Duplikat. Er bleibt bei Gleichstand, sonst wechselt die kanonische
  // URL von Nacht zu Nacht (der Dedup rechnet jeden Lauf neu).
  const pointedAt = new Set(events.map(e => e.duplicate_of).filter((id): id is string => !!id));
  const isCurrentPrimary = (e: EventRow) => (pointedAt.has(e.id) && e.publish_status !== 'duplicate') ? 1 : 0;
  // Zurückgehaltene Zeilen (needs_review/suppressed) dürfen keine sichtbare
  // Zeile verdrängen — sonst verschwände das Event ganz.
  const isVisible = (e: EventRow) =>
    e.publish_status === 'needs_review' || e.publish_status === 'suppressed' ? 0 : 1;

  return events.sort((a, b) => {
    if (isVisible(a) !== isVisible(b)) return isVisible(b) - isVisible(a);
    // Eine Zeile, die die Quelle nicht mehr liefert, darf nicht die kanonische sein.
    const freshA = isOrphan(a.id) ? 0 : 1;
    const freshB = isOrphan(b.id) ? 0 : 1;
    if (freshA !== freshB) return freshB - freshA;
    // Ein „Titel" nur aus Datum/Uhrzeit (Scraper-Artefakt) wird nicht angezeigt.
    const titledA = isDateOnlyTitle(a.title) ? 0 : 1;
    const titledB = isDateOnlyTitle(b.title) ? 0 : 1;
    if (titledA !== titledB) return titledB - titledA;

    // 0. Eventim always wins — it's the official ticket source with the
    //    affiliate buy link, so it must be the canonical event in any cluster.
    const eventimA = a.source_name === 'Eventim' ? 1 : 0;
    const eventimB = b.source_name === 'Eventim' ? 1 : 0;
    if (eventimA !== eventimB) return eventimB - eventimA;

    if (isCurrentPrimary(a) !== isCurrentPrimary(b)) return isCurrentPrimary(b) - isCurrentPrimary(a);

    // 1. quality_score DESC
    const scoreA = a.quality_score ?? 0;
    const scoreB = b.quality_score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2. description length DESC
    const descA = (a.description?.length ?? 0) > 50 ? a.description!.length : 0;
    const descB = (b.description?.length ?? 0) > 50 ? b.description!.length : 0;
    if (descA !== descB) return descB - descA;

    // 3. has image_url
    const imgA = a.image_url ? 1 : 0;
    const imgB = b.image_url ? 1 : 0;
    if (imgA !== imgB) return imgB - imgA;

    // 4. has ticket_url
    const tickA = a.ticket_url ? 1 : 0;
    const tickB = b.ticket_url ? 1 : 0;
    if (tickA !== tickB) return tickB - tickA;

    // 5. oldest created_at ASC
    const dateA = a.created_at ?? '';
    const dateB = b.created_at ?? '';
    return dateA.localeCompare(dateB);
  })[0];
}

// ---------------------------------------------------------------------------
// Field enrichment
// ---------------------------------------------------------------------------

/**
 * Compute fields to enrich on the primary from duplicates.
 * Only fills in fields that the primary is missing.
 */
export function computeEnrichments(
  primary: EventRow,
  duplicates: EventRow[],
): Record<string, unknown> {
  const enrichments: Record<string, unknown> = {};

  // description: longest meaningful one if primary has none/short
  if (!primary.description || primary.description.length < 50) {
    const best = duplicates
      .filter(d => d.description && d.description.length > 50)
      .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0];
    if (best?.description) {
      enrichments.description = best.description;
    }
  }

  // image_url
  if (!primary.image_url) {
    const withImg = duplicates.find(d => d.image_url);
    if (withImg) enrichments.image_url = withImg.image_url;
  }

  // ticket_url
  if (!primary.ticket_url) {
    const withTicket = duplicates.find(d => d.ticket_url);
    if (withTicket) enrichments.ticket_url = withTicket.ticket_url;
  }

  // end_date
  if (!primary.end_date) {
    const withEnd = duplicates.find(d => d.end_date);
    if (withEnd) enrichments.end_date = withEnd.end_date;
  }

  // price_text
  if (!primary.price_text) {
    const withPrice = duplicates.find(d => d.price_text);
    if (withPrice) enrichments.price_text = withPrice.price_text;
  }

  // organizer
  if (!primary.organizer) {
    const withOrg = duplicates.find(d => d.organizer);
    if (withOrg) enrichments.organizer = withOrg.organizer;
  }

  // tags: union of all tags
  const allTags = new Set<string>();
  for (const t of primary.tags ?? []) allTags.add(t);
  for (const dup of duplicates) {
    for (const t of dup.tags ?? []) allTags.add(t);
  }
  if (allTags.size > (primary.tags?.length ?? 0)) {
    enrichments.tags = [...allTags];
  }

  return enrichments;
}
