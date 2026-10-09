// src/lib/pipeline/dedup-cluster.ts

/**
 * Primary-Wahl und Feld-Anreicherung für Dedup-Cluster. Die Cluster selbst
 * bildet dedup-engine.ts (mit Mehrdeutigkeits- und Widerspruchsschutz).
 */

import { scoreToPublishStatus, type PublishStatus } from '@/lib/quality/score-event';
import { isDateOnlyText } from './garbage-filter';
import { knownStartMs, titleRelation, viennaDayOf } from './dedup-evidence';
import { isEventSpecificUrl, normalizeUrlForDedup } from './event-url';
import type { EventRow } from './types';

/**
 * Status, den eine Zeile ohne Dedup hätte — wie beim Upsert: Quarantäne und
 * Ortskonflikt (DB-Constraint) bleiben zurückgehalten, sonst entscheidet der
 * gespeicherte Qualitätsscore.
 */
export function underlyingStatus(row: {
  quality_score?: number | null;
  admission_decision?: string | null;
  location_status?: string | null;
}): PublishStatus {
  if (row.admission_decision === 'quarantine') return 'needs_review';
  if (row.location_status === 'conflict') return 'needs_review';
  return scoreToPublishStatus(row.quality_score ?? 0);
}

/** Wäre die Zeile ohne Dedup öffentlich sichtbar? */
export function wouldBeVisible(e: EventRow): boolean {
  if (e.location_status === 'conflict') return false;
  if (e.publish_status === 'duplicate') {
    const s = underlyingStatus(e);
    return s === 'published' || s === 'published_low_confidence';
  }
  return e.publish_status !== 'needs_review' && e.publish_status !== 'suppressed';
}

/** Uhrzeit-Spanne vor dem Titel („10:00 Uhr - 16:00 Uhr…"). */
const LEADING_TIME = /^\s*\d{1,2}[:.]\d{2}\s*(?:uhr)?\s*(?:-|–|bis)\s*\d{1,2}[:.]\d{2}/i;

/** `long` ist `short` mit angeklebtem Text ohne Trennzeichen. */
function gluedOnto(long: string | null | undefined, short: string | null | undefined): boolean {
  const l = (long ?? '').trim();
  const s = (short ?? '').trim();
  if (s.length < 8 || l.length <= s.length || !l.toLowerCase().startsWith(s.toLowerCase())) return false;
  return /^[\p{L}\p{N}"„“]/u.test(l.slice(s.length));
}

/** Basis- und Terminzeile derselben Serie („id" / „id:2026-10-14"). */
export function sameSeries(a: EventRow, b: EventRow): boolean {
  const family = (e: EventRow) => (e.source_id ?? '').replace(/:\d{4}-\d{2}-\d{2}$/, '');
  return !!a.source_name && a.source_name === b.source_name && a.source_id !== b.source_id &&
    !!a.source_id && family(a) === family(b);
}

/**
 * Ältere Fassungen einer Event-Seite: dieselbe Quelle liefert dieselbe
 * Detailseite für denselben Wiener Tag inzwischen als andere Zeile (Titel
 * korrigiert oder umbenannt: „13 Dez. Adventsingen 13.12.2026 14:00 Uhr" →
 * „Adventsingen", „Zankerlschnapsen" → „Zankerltriathlon"). Solche Zeilen
 * gelten im Dedup wie verwaiste: nie Primary, nie Gegenbeleg, nie
 * freigegeben. Nur am selben Tag: Serien-Seiten zeigen oft nur den nächsten
 * Termin, frühere Sichtungen späterer Termine sind echt (Prod 2026-10-09:
 * 1.447 solche Zeilen). Und nur, wenn die Titel zusammenpassen oder die
 * Seite im letzten Besuch genau einen Titel trug (keine Veranstalter-Website
 * mit mehreren Events), nie zwischen Basis- und Terminzeilen einer Serie.
 */
export function staleVersionIds(rows: EventRow[]): Set<string> {
  const DAY = 86_400_000;
  const seen = (e: EventRow) => (e.last_seen_at ? Date.parse(e.last_seen_at) : NaN);
  const pages = new Map<string, EventRow[]>();
  for (const r of rows) {
    const url = normalizeUrlForDedup(r.source_url);
    if (!url || !isEventSpecificUrl(url) || !r.source_name || isNaN(seen(r))) continue;
    const key = `${r.source_name}|${url}`;
    pages.set(key, [...(pages.get(key) ?? []), r]);
  }
  const out = new Set<string>();
  for (const list of pages.values()) {
    if (list.length < 2) continue;
    const newest = Math.max(...list.map(seen));
    const lastVisitTitles = new Set(list.filter(r => seen(r) >= newest - 12 * 3_600_000)
      .map(r => (r.title ?? '').trim().toLowerCase()));
    for (const r of list) {
      const day = viennaDayOf(r);
      const newer = day ? list.find(n => n !== r && viennaDayOf(n) === day && !sameSeries(n, r) && seen(n) - seen(r) > DAY) : undefined;
      if (!newer) continue;
      const t = titleRelation(r, newer);
      if (t === 'equal' || t === 'near' || t === 'contains' || lastVisitTitles.size === 1) out.add(r.id);
    }
  }
  return out;
}

/** Zusatzprodukte einer Show (Eventim führt sie als eigene Produkte). */
const ADD_ON = /\b(?:vip|package|packages|upgrade|paket|camping|caravan|parken|parking|hotelpaket|fanpaket)\b/i;

// Endet nicht mit \b: „… am 10.10." hat nach dem Punkt kein Wortzeichen.
const DATE_IN_TITLE = /\b\d{1,2}\.\s?\d{1,2}\.\s?(\d{2}|\d{4})?(?!\d)/;

/** Die Kennung der Quelle trägt den eigenen Termin (Wiener Tag als
 *  YYYY-MM-DD oder YYYYMMDD), z. B. „feratel-bccca177:2026-10-14". */
function idCarriesDate(e: EventRow): boolean {
  const day = e.source_id && e.start_date ? viennaDayOf(e) : null;
  return !!day && (e.source_id!.includes(day) || e.source_id!.includes(day.replace(/-/g, '')));
}

/** Titel, der nach Abzug von Datum, Wochentag, Uhrzeit und Satzzeichen leer
 *  ist. Gleiches Vokabular wie der Müll-Filter (garbage-filter.ts). */
export function isDateOnlyTitle(title: string | null | undefined): boolean {
  return isDateOnlyText(title);
}

// ---------------------------------------------------------------------------
// Primary selection
// ---------------------------------------------------------------------------

/**
 * Select the best event as primary from a cluster.
 *
 * Criteria (in order):
 * 1. Sichtbar (nicht needs_review/suppressed/Ortskonflikt)
 * 2. Von der Quelle noch geliefert (nicht verwaist), bei derselben Seite
 *    die zuletzt gesehene Fassung, bei Serien die Terminzeile statt der
 *    wandernden Basiszeile
 * 3. Echter Titel (nicht nur Datum/Uhrzeit)
 * 4. Eventim (Affiliate-Ticketlink)
 * 5. Titel ohne eingebautes Datum
 * 6. Bisheriger Primary (stabile URL)
 * 7. Highest quality_score
 * 8. Longest meaningful description (> 50 chars)
 * 9. Has image_url
 * 10. Has ticket_url
 * 11. Oldest created_at
 */
export function selectPrimary(events: EventRow[], isOrphan: (id: string) => boolean = () => false): EventRow {
  // Bisheriger Primary: auf ihn zeigt ein anderes Mitglied, er selbst ist
  // kein Duplikat. Er bleibt bei Gleichstand, sonst wechselt die kanonische
  // URL von Nacht zu Nacht (der Dedup rechnet jeden Lauf neu).
  const pointedAt = new Set(events.map(e => e.duplicate_of).filter((id): id is string => !!id));
  const isCurrentPrimary = (e: EventRow) => (pointedAt.has(e.id) && e.publish_status !== 'duplicate') ? 1 : 0;
  // Zurückgehaltene Zeilen (needs_review/suppressed) dürfen keine sichtbare
  // Zeile verdrängen — sonst verschwände das Event ganz. Bei Duplikaten zählt,
  // was sie freigegeben wären (sonst kippt der Primary jede Nacht).
  const isVisible = (e: EventRow) => (wouldBeVisible(e) ? 1 : 0);
  // Ältere Fassung derselben Seite: die Quelle liefert dieselbe URL
  // inzwischen als andere Zeile (neuer Titel, neue Kennung). Die zuletzt
  // gesehene ist die aktuelle (Prod 2026-10-08: Absagen und Titelkorrekturen).
  // Basis- und Terminzeilen einer Serie (Feratel „id" / „id:2026-10-14")
  // sind verschiedene Termine, keine Fassungen (gemeinsame Veranstalter-URL).
  const seen = (e: EventRow) => (e.last_seen_at ? Date.parse(e.last_seen_at) : NaN);
  const isOlderVersion = (e: EventRow) => (events.some(n =>
    n !== e && !!n.source_url && n.source_url === e.source_url && n.source_name === e.source_name &&
    !sameSeries(n, e) && seen(n) - seen(e) > 86_400_000 && (wouldBeVisible(n) || !wouldBeVisible(e))) ? 1 : 0);
  // Ohne Koordinaten fehlt ein Event in Liste und Karte (/api/events,
  // event_map_points filtern auf lat/lng; Stichprobe 2026-10-09).
  const hasPin = (e: EventRow) => (e.latitude != null && e.longitude != null ? 1 : 0);
  // Listen-Text am Titel: angeklebter Zusatz ohne Trennzeichen („…„Der
  // Kasperl kommt“Buch & Co.") oder Uhrzeit davor („10:00 Uhr - 16:00 Uhr…").
  const isUnclean = (e: EventRow) => (LEADING_TIME.test(e.title ?? '') ||
    events.some(n => n !== e && gluedOnto(e.title, n.title)) ? 1 : 0);

  // Serien-Basiszeile: dieselbe Quelle führt für den Termin eine eigene Zeile
  // mit dem Datum in der Kennung (Feratel „…:2026-10-14"). Die Basiszeile
  // ohne Datum wandert jede Nacht zum nächsten Termin und darf deshalb nie
  // die kanonische Zeile (und URL) eines Termins sein.
  const isWanderingBase = (e: EventRow) => (!idCarriesDate(e) && events.some(n =>
    n !== e && n.source_name === e.source_name && idCarriesDate(n) &&
    (wouldBeVisible(n) || !wouldBeVisible(e)))) ? 1 : 0;

  return events.sort((a, b) => {
    if (isVisible(a) !== isVisible(b)) return isVisible(b) - isVisible(a);
    // Eine Zeile, die die Quelle nicht mehr liefert, darf nicht die kanonische sein.
    const freshA = isOrphan(a.id) ? 0 : 1;
    const freshB = isOrphan(b.id) ? 0 : 1;
    if (freshA !== freshB) return freshB - freshA;
    if (hasPin(a) !== hasPin(b)) return hasPin(b) - hasPin(a);
    if (isUnclean(a) !== isUnclean(b)) return isUnclean(a) - isUnclean(b);
    if (isOlderVersion(a) !== isOlderVersion(b)) return isOlderVersion(a) - isOlderVersion(b);
    if (isWanderingBase(a) !== isWanderingBase(b)) return isWanderingBase(a) - isWanderingBase(b);
    // Ein „Titel" nur aus Datum/Uhrzeit (Scraper-Artefakt) wird nicht angezeigt.
    const titledA = isDateOnlyTitle(a.title) ? 0 : 1;
    const titledB = isDateOnlyTitle(b.title) ? 0 : 1;
    if (titledA !== titledB) return titledB - titledA;

    // 0. Eventim always wins — it's the official ticket source with the
    //    affiliate buy link, so it must be the canonical event in any cluster.
    const eventimA = a.source_name === 'Eventim' ? 1 : 0;
    const eventimB = b.source_name === 'Eventim' ? 1 : 0;
    if (eventimA !== eventimB) return eventimB - eventimA;

    // Eingebautes Datum („… 19.11.2026") ist Listen-Text der Quelle, kein Titel.
    const cleanA = DATE_IN_TITLE.test(a.title ?? '') ? 0 : 1;
    const cleanB = DATE_IN_TITLE.test(b.title ?? '') ? 0 : 1;
    if (cleanA !== cleanB) return cleanB - cleanA;

    // Zusatzprodukt („- VIP Package", „Upgrade", „Camping") ist nicht die Show.
    const mainA = ADD_ON.test(a.title ?? '') ? 0 : 1;
    const mainB = ADD_ON.test(b.title ?? '') ? 0 : 1;
    if (mainA !== mainB) return mainB - mainA;

    // Echte Uhrzeit vor Platzhalter- oder Datums-Uhrzeit (17:10 für den 17.10.),
    // auch gegen den bisherigen Primary (Stichprobe 2026-10-09).
    const timedA = knownStartMs(a) !== null ? 1 : 0;
    const timedB = knownStartMs(b) !== null ? 1 : 0;
    if (timedA !== timedB) return timedB - timedA;

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
