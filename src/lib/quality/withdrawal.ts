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
 * 860 Sites seit 30 Tagen gar nicht), Listen haben Seitenobergrenzen, und
 * viele Scraper lesen ihre Liste nicht bei jedem Lauf vollständig.
 * Stichprobe 2026-10-06: von 125 Events, die ein späterer Besuch ihrer
 * Seite nicht mehr fand, waren nur 15 an der Quelle wirklich weg; 47
 * standen dort noch mit Datum (u. a. Erste Bank Open bei wien-ticket).
 * Zurückgezogen wird deshalb nur mit positivem Beleg:
 *
 *  A) missing_from_source — Vorauswahl: derselbe Abdeckungsbereich (Quelle
 *     + Website, siehe `coverageScope`) wurde mindestens `minGapDays` nach
 *     der letzten Sichtung erneut gelesen, dieser Besuch fand mindestens
 *     `minVisitEvents` Termine und reichte zeitlich über das Event hinaus.
 *     Beleg: die eigene Detailseite des Events liefert 404 oder 410
 *     (`probeGone`). Listen-URLs, die mehrere Events teilen, beweisen
 *     nichts und werden nicht geprüft.
 *  B) source_dead — die Quelle hat seit `deadSourceDays` gar nichts mehr
 *     geliefert, während die Pipeline sonst läuft. Ist sie ganz abgeschaltet
 *     (kein Lauf mehr, z. B. oeticket nach dem Eventim-Feed), wird ohne
 *     Abruf zurückgezogen. Läuft ihr Scraper noch und findet nur nichts
 *     (ticketmaster, events.at 2026-10), ist der Scraper kaputt, nicht das
 *     Event abgesagt: dann gilt derselbe Detailseiten-Beleg wie bei A.
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

export interface WithdrawalItem {
  id: string;
  source_name: string;
  scope: string;
  reason: WithdrawalReason;
}

export interface WithdrawalPlan {
  /** Ohne weiteren Beleg zurückzuziehen (Quelle tot). */
  withdraw: WithdrawalItem[];
  /** Erst zurückziehen, wenn die Detailseite weg ist (`probeGone`). */
  probe: Array<WithdrawalItem & { url: string }>;
}

export interface WithdrawalOptions {
  now: Date;
  minGapDays?: number;
  visitWindowHours?: number;
  minVisitEvents?: number;
  deadSourceDays?: number;
  freshnessDays?: number;
  /** Quellen mit einem Scrape-Lauf in den letzten Tagen (source_runs). */
  runningSources?: ReadonlySet<string>;
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
    deadSourceDays = 30,
    freshnessDays = 2,
    runningSources = new Set<string>(),
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
  // Nur eine eigene Detailseite kann belegen, dass das Event weg ist.
  const urlUses = new Map<string, number>();
  for (const r of rows) {
    if (r.duplicate_of && ms(r.last_seen_at) >= nowMs - minGapDays * DAY) confirmedElsewhere.add(r.duplicate_of);
    if (r.source_url) urlUses.set(r.source_url, (urlUses.get(r.source_url) ?? 0) + 1);
  }

  const pipelineRuns = globalLastSeen >= nowMs - freshnessDays * DAY;
  const plan: WithdrawalPlan = { withdraw: [], probe: [] };

  for (const r of rows) {
    if (!VISIBLE.has(r.publish_status ?? '') || ms(r.start_date) < nowMs) continue;
    if (confirmedElsewhere.has(r.id)) continue;
    const scope = coverageScope(r);

    const seen = ms(r.last_seen_at);
    const url = r.source_url && urlUses.get(r.source_url) === 1 ? r.source_url : null;
    if (pipelineRuns && sourceLastSeen.get(r.source_name)! < nowMs - deadSourceDays * DAY) {
      if (!runningSources.has(r.source_name)) {
        plan.withdraw.push({ id: r.id, source_name: r.source_name, scope, reason: 'source_dead' });
      } else if (url) {
        plan.probe.push({ id: r.id, source_name: r.source_name, scope, reason: 'source_dead', url });
      }
      continue;
    }
    const missed =
      seen < scopeLastVisit.get(scope)! - minGapDays * DAY &&
      ms(r.start_date) <= visitHorizon.get(scope)! &&
      (visitCount.get(scope) ?? 0) >= minVisitEvents;
    if (missed && url) {
      plan.probe.push({ id: r.id, source_name: r.source_name, scope, reason: 'missing_from_source', url });
    }
  }
  return plan;
}

export interface ProbeOptions {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  /** Höchstens so viele Abrufe je Lauf; der Rest kommt in der nächsten Nacht. */
  budget?: number;
  /** Websites parallel; je Website immer nur ein Abruf gleichzeitig. */
  hostConcurrency?: number;
  timeoutMs?: number;
  /** Pause zwischen zwei Abrufen derselben Website (Gemeinde-Server sind klein). */
  hostDelayMs?: number;
  maxHostFailures?: number;
}

/**
 * Ruft Detailseiten ab und liefert die, die belegt weg sind: Endstatus
 * (nach Weiterleitungen) 404 oder 410. Alles andere — 200, 403, 5xx,
 * Zeitüberschreitung, Netzwerkfehler — ist kein Beleg.
 *
 * Eine Website, die `maxHostFailures` Mal in Folge nichts Verwertbares
 * liefert (Fehler, 403/429, 5xx), wird für diesen Lauf aufgegeben: oeticket
 * sperrt Bots, 354 Abrufe liefen dort sonst je 15 s in die Zeitüberschreitung.
 */
export async function probeGone(urls: string[], options: ProbeOptions = {}): Promise<Set<string>> {
  const { fetchImpl = fetch, budget = Infinity, hostConcurrency = 8, timeoutMs = 15_000, hostDelayMs = 500, maxHostFailures = 3 } = options;
  const byHost = new Map<string, string[]>();
  for (const url of urls.slice(0, budget)) {
    let host: string;
    try { host = new URL(url).host; } catch { continue; }
    byHost.set(host, [...(byHost.get(host) ?? []), url]);
  }

  const gone = new Set<string>();
  const queues = [...byHost.values()];
  const worker = async () => {
    for (let q = queues.shift(); q; q = queues.shift()) {
      let failures = 0;
      for (const [i, url] of q.entries()) {
        if (failures >= maxHostFailures) break;
        if (i > 0 && hostDelayMs > 0) await new Promise((r) => setTimeout(r, hostDelayMs));
        try {
          const res = await fetchImpl(url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'User-Agent': 'LassTreffenBot/1.0 (+https://lasstreffen.at/quellen)' },
          });
          if (res.status === 404 || res.status === 410) gone.add(url);
          failures = res.status < 400 || res.status === 404 || res.status === 410 ? 0 : failures + 1;
          // Body nicht lesen, aber freigeben — sonst hält undici die Verbindung.
          await res.body?.cancel().catch(() => {});
        } catch {
          failures++; // kein Beleg
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(hostConcurrency, queues.length) }, worker));
  return gone;
}
