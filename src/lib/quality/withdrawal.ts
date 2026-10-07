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
 *     (events.at 2026-10), ist der Scraper kaputt, nicht das Event
 *     abgesagt: dann gilt derselbe Detailseiten-Beleg wie bei A. Ein
 *     Scraper ohne Pflicht-Konfiguration (ticketmaster ohne API-Key) läuft
 *     nicht: `runScraper` schreibt für ihn keinen source_runs-Eintrag.
 *  C) superseded — die Quelle listet dieselbe Seite am selben Wiener Tag
 *     unter einer neuen Kennung. Scraper mit source_id aus dem Titel legen
 *     nach jeder Titel-Korrektur eine neue Zeile an, die alte bekommt nie
 *     wieder ein Upsert (Prod 2026-10-07: gemeinden-generic, Linzer
 *     Detailseiten, "Linz-Card" neben "Pre-Concert für Danish String
 *     Quartet", dazu die Wiener Datenschutz-PLZ aus der Zeit vor dem
 *     Kontext-Filter). Beleg ist die neue Zeile: der letzte Besuch dieser
 *     URL hat für den Tag eine andere Zeile geliefert, die erst auftauchte,
 *     als die alte schon nicht mehr kam (nie beide zugleich gelistet), und
 *     die Seite trug dabei nur einen Titel (eigene Seite eines Events, keine
 *     Liste). Kein Abruf nötig — linztourismus.at leitet jede Detailseite
 *     ohne Sitzung auf die Startseite um, ein 404 gibt es dort nie.
 *     Gilt auch für zurückgehaltene Zeilen (needs_review): die Orts-
 *     Neuberechnung gibt sie frei, sobald ihr Konflikt verschwindet.
 *
 * Ein Primary bleibt stehen, solange ein verborgenes Duplikat noch gelistet
 * ist: das Event wäre sonst ganz weg, obwohl eine Quelle es bestätigt, bis
 * der nächste Dedup-Lauf das Duplikat freigibt.
 *
 * Rein und ohne I/O. Ausführung: `src/scripts/withdraw-stale-events.ts`.
 */
import { toViennaDate } from '@/lib/utils/event-time';

export interface SightingRow {
  id: string;
  source_name: string;
  source_url: string | null;
  title: string | null;
  start_date: string;
  /** Erste Sichtung (Insert durch den Sync). */
  created_at: string | null;
  last_seen_at: string | null;
  publish_status: string | null;
  duplicate_of: string | null;
}

export type WithdrawalReason = 'missing_from_source' | 'source_dead' | 'superseded';

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
/** Was ein Rückzug ändern darf: sichtbar oder (nur Regel C) zurückgehalten. */
export const WITHDRAWABLE_STATUSES = ['published', 'published_low_confidence', 'needs_review'] as const;
const WITHDRAWABLE = new Set<string>(WITHDRAWABLE_STATUSES);
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
const viennaDay = (iso: string) => toViennaDate(new Date(iso));
const titleKey = (title: string | null) => (title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Regel C: Zeilen, die ihre Quelle unter neuer Kennung listet. Je Quelle +
 * URL zählt der letzte Besuch (jüngste Sichtung, `visitWindowHours`).
 */
function supersededCheck(rows: SightingRow[], minGapDays: number, visitWindowHours: number) {
  const pageKey = (r: SightingRow) => `${r.source_name}|${r.source_url}`;
  const lastVisit = new Map<string, number>();
  for (const r of rows) {
    const seen = ms(r.last_seen_at);
    if (!r.source_url || isNaN(seen)) continue;
    lastVisit.set(pageKey(r), Math.max(lastVisit.get(pageKey(r)) ?? -Infinity, seen));
  }
  // Titel der Seite im letzten Besuch; Zeilen dieses Besuchs je Wiener Tag.
  // Eine unterdrückte Zeile (Müll-Titel) belegt kein Event, zählt aber als
  // weiterer Titel: dann ist die Seite nicht eindeutig.
  const titles = new Map<string, Set<string>>();
  const byDay = new Map<string, SightingRow[]>();
  for (const r of rows) {
    const seen = ms(r.last_seen_at);
    if (!r.source_url || isNaN(seen)) continue;
    const key = pageKey(r);
    if (seen < lastVisit.get(key)! - visitWindowHours * 3_600_000) continue;
    titles.set(key, (titles.get(key) ?? new Set()).add(titleKey(r.title)));
    if (r.publish_status === 'suppressed') continue;
    const dayKey = `${key}|${viennaDay(r.start_date)}`;
    const list = byDay.get(dayKey);
    if (list) list.push(r);
    else byDay.set(dayKey, [r]);
  }

  return (r: SightingRow): boolean => {
    if (!r.source_url) return false;
    const key = pageKey(r);
    const seen = ms(r.last_seen_at);
    if (isNaN(seen) || seen >= lastVisit.get(key)! - minGapDays * DAY) return false;
    if (titles.get(key)?.size !== 1) return false;
    // Erst nach der letzten Sichtung der alten Zeile aufgetaucht: beide
    // zugleich gelistet hieße zwei Events auf einer Seite.
    return (byDay.get(`${key}|${viennaDay(r.start_date)}`) ?? []).some((n) => ms(n.created_at) >= seen);
  };
}

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
    // Nur ein verborgenes Duplikat: sichtbare Zeilen mit altem Verweis
    // (Prod 2026-10-07: 79 künftige) zeigen das Event ohnehin selbst.
    if (r.duplicate_of && r.publish_status === 'duplicate' && ms(r.last_seen_at) >= nowMs - minGapDays * DAY) {
      confirmedElsewhere.add(r.duplicate_of);
    }
    if (r.source_url) urlUses.set(r.source_url, (urlUses.get(r.source_url) ?? 0) + 1);
  }

  const pipelineRuns = globalLastSeen >= nowMs - freshnessDays * DAY;
  const isSuperseded = supersededCheck(rows, minGapDays, visitWindowHours);
  const plan: WithdrawalPlan = { withdraw: [], probe: [] };

  for (const r of rows) {
    if (!WITHDRAWABLE.has(r.publish_status ?? '') || ms(r.start_date) < nowMs) continue;
    if (confirmedElsewhere.has(r.id)) continue;
    const scope = coverageScope(r);
    if (isSuperseded(r)) {
      plan.withdraw.push({ id: r.id, source_name: r.source_name, scope, reason: 'superseded' });
      continue;
    }
    if (!VISIBLE.has(r.publish_status ?? '')) continue;

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
