/**
 * Zurückgezogene Events erkennen: die Quelle listet ein Event nicht mehr.
 *
 * Warum: Ein Upsert aktualisiert nur, was ein Scraper findet. Was eine
 * Quelle streicht (abgesagt, verschoben, falsch geparst und inzwischen
 * korrigiert), blieb bis zum Termin veröffentlicht. Befund 2026-10-06:
 * ~8.000 künftige Events seit über 30 Tagen von keiner Quelle mehr gesehen,
 * darunter 540 Müll-Titel ("Mittwoch", "Gemeindesaal") aus einem
 * inzwischen behobenen Parser und 362 Events zweier Quellen, die seit Mai
 * nichts mehr liefern.
 *
 * "Nicht gesehen" allein ist kein Beleg: die Gemeinde-Aggregatoren
 * besuchen jede Website nur alle paar Tage (bei gemeinde-registry 254 von
 * 860 Sites seit 30 Tagen gar nicht), Listen haben Seitenobergrenzen.
 * Zurückgezogen wird deshalb nur mit positivem Beleg:
 *
 *  A) missing_from_source — derselbe Abdeckungsbereich (Quelle + Website,
 *     siehe `coverageScope`) wurde mindestens `minGapDays` nach der letzten
 *     Sichtung des Events erneut gelesen, dieser Besuch fand mindestens
 *     `minVisitEvents` Termine und reichte zeitlich über das Event hinaus.
 *     Würde ein Bereich mehr als `maxScopeShare` seiner Events verlieren,
 *     ist eher der Scraper kaputt: der Bereich wird übersprungen und
 *     gemeldet.
 *  B) source_dead — die Quelle hat seit `deadSourceDays` gar nichts mehr
 *     geliefert, während die Pipeline sonst läuft.
 *
 * Ein Primary bleibt stehen, solange ein Duplikat (andere Quelle) noch
 * gelistet ist: der Dedup befördert Duplikate nie zurück, das Event wäre
 * sonst ganz weg, obwohl eine Quelle es bestätigt.
 *
 * Rein und ohne I/O. Ausführung: `src/scripts/withdraw-stale-events.ts`.
 */

export interface SightingRow {
  id: string;
  source_name: string;
  source_url: string | null;
  start_date: string;
  last_seen_at: string | null;
  publish_status: string | null;
  duplicate_of: string | null;
}

export type WithdrawalReason = 'missing_from_source' | 'source_dead';

export interface WithdrawalPlan {
  withdraw: Array<{ id: string; source_name: string; scope: string; reason: WithdrawalReason }>;
  /** Bereiche, in denen zu viel verschwunden wäre — Scraper prüfen. */
  skippedScopes: Array<{ source_name: string; scope: string; candidates: number; visible: number }>;
}

export interface WithdrawalOptions {
  now: Date;
  minGapDays?: number;
  visitWindowHours?: number;
  minVisitEvents?: number;
  maxScopeShare?: number;
  deadSourceDays?: number;
  freshnessDays?: number;
}

const VISIBLE = new Set(['published', 'published_low_confidence']);
const DAY = 86_400_000;

/**
 * Bereich, den ein Scraper in einem Zug vollständig (oder bis zu einem
 * Datum) liest. Standard: die Domain der Quell-URL — jede Gemeinde-Website
 * ist ein eigener Bereich. Quellen, die mehrere Listen mit eigener
 * Seitenobergrenze unter einer Domain lesen, brauchen eine feinere Regel.
 */
export function coverageScope(row: Pick<SightingRow, 'source_name' | 'source_url'>): string {
  const m = row.source_url?.match(/^https?:\/\/([^/?#]+)(\/[^/?#]*)?/i);
  const host = (m?.[1] ?? '').toLowerCase().replace(/^www\./, '');
  // je Bundesland bis zu 200 Seiten (VeranstaltungskalenderNetScraper)
  if (row.source_name === 'veranstaltungskalender.net' && m?.[2]) {
    return `${row.source_name}|${host}${m[2].toLowerCase()}`;
  }
  return `${row.source_name}|${host}`;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

export function planWithdrawals(rows: SightingRow[], options: WithdrawalOptions): WithdrawalPlan {
  const {
    now,
    minGapDays = 7,
    visitWindowHours = 12,
    minVisitEvents = 3,
    maxScopeShare = 0.5,
    deadSourceDays = 30,
    freshnessDays = 2,
  } = options;
  const nowMs = now.getTime();

  // Zuletzt gesehene Sichtung je Bereich und je Quelle, global.
  const scopeLastVisit = new Map<string, number>();
  const sourceLastSeen = new Map<string, number>();
  let globalLastSeen = -Infinity;
  for (const r of rows) {
    const seen = ms(r.last_seen_at);
    if (isNaN(seen)) continue;
    const scope = coverageScope(r);
    scopeLastVisit.set(scope, Math.max(scopeLastVisit.get(scope) ?? -Infinity, seen));
    sourceLastSeen.set(r.source_name, Math.max(sourceLastSeen.get(r.source_name) ?? -Infinity, seen));
    globalLastSeen = Math.max(globalLastSeen, seen);
  }

  // Der letzte Besuch je Bereich: wie viele Termine, bis zu welchem Datum.
  const visitCount = new Map<string, number>();
  const visitHorizon = new Map<string, number>();
  for (const r of rows) {
    const scope = coverageScope(r);
    const seen = ms(r.last_seen_at);
    if (isNaN(seen) || seen < scopeLastVisit.get(scope)! - visitWindowHours * 3_600_000) continue;
    visitCount.set(scope, (visitCount.get(scope) ?? 0) + 1);
    visitHorizon.set(scope, Math.max(visitHorizon.get(scope) ?? -Infinity, ms(r.start_date)));
  }

  // Primaries mit einem Duplikat, das noch gelistet wird.
  const confirmedElsewhere = new Set<string>();
  for (const r of rows) {
    if (r.duplicate_of && ms(r.last_seen_at) >= nowMs - minGapDays * DAY) confirmedElsewhere.add(r.duplicate_of);
  }

  const pipelineRuns = globalLastSeen >= nowMs - freshnessDays * DAY;
  const plan: WithdrawalPlan = { withdraw: [], skippedScopes: [] };
  const byScope = new Map<string, { source_name: string; visible: number; candidates: string[] }>();

  for (const r of rows) {
    if (!VISIBLE.has(r.publish_status ?? '') || ms(r.start_date) < nowMs) continue;
    const scope = coverageScope(r);
    const bucket = byScope.get(scope) ?? { source_name: r.source_name, visible: 0, candidates: [] };
    byScope.set(scope, bucket);
    bucket.visible++;
    if (confirmedElsewhere.has(r.id)) continue;

    const seen = ms(r.last_seen_at);
    if (pipelineRuns && sourceLastSeen.get(r.source_name)! < nowMs - deadSourceDays * DAY) {
      plan.withdraw.push({ id: r.id, source_name: r.source_name, scope, reason: 'source_dead' });
      continue;
    }
    const missed =
      seen < scopeLastVisit.get(scope)! - minGapDays * DAY &&
      ms(r.start_date) <= visitHorizon.get(scope)! &&
      (visitCount.get(scope) ?? 0) >= minVisitEvents;
    if (missed) bucket.candidates.push(r.id);
  }

  for (const [scope, b] of byScope) {
    if (b.candidates.length === 0) continue;
    if (b.candidates.length > 5 && b.candidates.length > b.visible * maxScopeShare) {
      plan.skippedScopes.push({ source_name: b.source_name, scope, candidates: b.candidates.length, visible: b.visible });
      continue;
    }
    for (const id of b.candidates) {
      plan.withdraw.push({ id, source_name: b.source_name, scope, reason: 'missing_from_source' });
    }
  }
  return plan;
}
