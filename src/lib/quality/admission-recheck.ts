/**
 * Nächtliche Nachprüfung des Freigabevertrags im Bestand.
 *
 * WARUM
 * ─────
 * `publish_status` entsteht beim Schreiben: Upsert (supabase-sync.ts) und
 * erneute Ortsentscheidung (re-resolve.ts). Eine Zeile, die keine Quelle mehr
 * liefert, erreicht keiner der beiden. Neue Regeln ließen sie deshalb stehen:
 * drei Tage nach der Gemeinde-Dienst-Regel waren noch 127 Müll- und
 * Sprechtag-Termine sichtbar, nach der Horizont-Regel 170 Gutscheine und
 * Tippfehler-Jahre (Prod 2026-10-14 bis 17, alle zuletzt Mai bis September
 * gesehen, die meisten ohne Quellenstand).
 *
 * Die Regeln, die nur an Titel und Termin hängen
 * (`titleTimeQuarantineReasons`, genau die `NON_LOCATION_REASONS`), lassen
 * sich für jede gespeicherte Zeile neu rechnen. Ortsregeln nicht: sie
 * brauchen Rohwerte und Belege und bleiben Sache von Sync und re-resolve.
 *
 * REGELN
 * ──────
 * - Sichtbar und ein Grund trifft zu → `needs_review`, Grund ins Protokoll.
 * - `needs_review` und ein Grund im Protokoll trifft nicht mehr zu (Regel
 *   zurückgenommen, Termin in den Horizont gerückt) → Grund aus dem
 *   Protokoll; hält sonst nichts mehr, gilt der Status aus dem Score wie
 *   beim Upsert.
 * - `needs_review`, Grund trifft zu, steht aber nicht im Protokoll → nur
 *   eintragen, damit die spätere Rücknahme ihn findet.
 * - Duplikate und zurückgezogene Zeilen bleiben unberührt: ihren Status
 *   rechnet der Dedup (`underlyingStatus`) mit derselben Regel.
 *
 * Protokoll heißt wie in Sync und re-resolve: `admission:<Grund>` in
 * `location_resolution.reasons`, dazu `location_resolution.admission`.
 *
 * REIN, kein I/O.
 */
import {
  NON_LOCATION_REASONS,
  titleTimeQuarantineReasons,
  type AdmissionReason,
} from './admission';
import { scoreToPublishStatus } from './score-event';

const VISIBLE = new Set(['published', 'published_low_confidence']);

/** Was die Nachprüfung von einer Zeile liest. */
export interface RecheckRow {
  id: string;
  title: string | null;
  start_date: string | null;
  publish_status: string | null;
  quality_score: number | null;
  location_status: string | null;
  /** `location_resolution->reasons` */
  reasons: string[] | null;
}

export type RecheckAction =
  /** Sichtbar → `needs_review`. */
  | 'hold'
  /** `needs_review` → Status aus dem Score. */
  | 'release'
  /** Nur das Protokoll ändert sich, der Status nicht. */
  | 'protocol';

export interface RecheckChange {
  id: string;
  action: RecheckAction;
  /** Neuer Status, nur bei `hold` und `release`. */
  publish_status?: string;
  added: AdmissionReason[];
  removed: AdmissionReason[];
}

const PREFIX = 'admission:';

/** Titel- und Zeitgründe, die das Protokoll der Zeile trägt. */
function protocolReasons(reasons: string[] | null): AdmissionReason[] {
  const out: AdmissionReason[] = [];
  for (const r of reasons ?? []) {
    if (!r.startsWith(PREFIX)) continue;
    const reason = r.slice(PREFIX.length) as AdmissionReason;
    if (NON_LOCATION_REASONS.has(reason) && !out.includes(reason)) out.push(reason);
  }
  return out;
}

/**
 * Hält die Zeile ohne die entfallenen Gründe noch etwas zurück? Wie in
 * re-resolve (`publishChangeFor`): ein Ortskonflikt, ein anderer Grund des
 * Vertrags, ein fehlender Quellenstand.
 */
function stillHeld(row: RecheckRow, removed: AdmissionReason[]): boolean {
  if (row.location_status === 'conflict') return true;
  const gone = new Set(removed.map(r => `${PREFIX}${r}`));
  return (row.reasons ?? []).some(
    r =>
      (r.startsWith(PREFIX) && r !== `${PREFIX}drop_coordinates` && !gone.has(r)) ||
      r === 'raw_persist_failed' ||
      r === 'location_conflict_withheld',
  );
}

export function planRecheckRow(row: RecheckRow, now: Date): RecheckChange | null {
  const status = row.publish_status ?? '';
  if (!VISIBLE.has(status) && status !== 'needs_review') return null;

  const current = titleTimeQuarantineReasons(row, now);
  const logged = protocolReasons(row.reasons);
  const added = current.filter(r => !logged.includes(r));
  const removed = logged.filter(r => !current.includes(r));

  if (VISIBLE.has(status)) {
    if (current.length === 0) return null;
    return { id: row.id, action: 'hold', publish_status: 'needs_review', added, removed };
  }

  // needs_review
  if (added.length === 0 && removed.length === 0) return null;
  if (current.length === 0 && !stillHeld(row, removed) && row.quality_score != null) {
    const next = scoreToPublishStatus(row.quality_score);
    if (next !== 'needs_review') return { id: row.id, action: 'release', publish_status: next, added, removed };
  }
  return { id: row.id, action: 'protocol', added, removed };
}

export function planAdmissionRecheck(rows: RecheckRow[], now: Date): RecheckChange[] {
  const out: RecheckChange[] = [];
  for (const row of rows) {
    const change = planRecheckRow(row, now);
    if (change) out.push(change);
  }
  return out;
}

type Resolution = Record<string, unknown> & {
  reasons?: unknown;
  admission?: { decision?: string; reasons?: unknown; corrections?: unknown } | null;
};

/**
 * Neues `location_resolution` mit den geänderten Gründen. Alles andere
 * (Ortsentscheidung, Belege, Eingabehash) bleibt, wie es ist. Eine Zeile
 * ganz ohne Protokoll (Altbestand) bekommt nur Gründe und Vertragsurteil.
 */
export function protocolWith(
  resolution: Resolution | null,
  change: Pick<RecheckChange, 'added' | 'removed'>,
  nowIso: string,
): Resolution {
  const base: Resolution = { ...(resolution ?? {}) };
  const gone = new Set<string>(change.removed);
  const reasons = (Array.isArray(base.reasons) ? (base.reasons as string[]) : []).filter(
    r => !(r.startsWith(PREFIX) && gone.has(r.slice(PREFIX.length))),
  );
  for (const r of change.added) reasons.push(`${PREFIX}${r}`);
  base.reasons = reasons;

  const prev = base.admission ?? null;
  if (prev || change.added.length > 0) {
    const prevReasons = Array.isArray(prev?.reasons) ? (prev!.reasons as string[]) : [];
    const admissionReasons = prevReasons.filter(r => !gone.has(r));
    for (const r of change.added) if (!admissionReasons.includes(r)) admissionReasons.push(r);
    base.admission = {
      ...(prev ?? {}),
      decision:
        admissionReasons.length > 0 ? 'quarantine' : prev?.decision === 'quarantine' ? 'admit' : (prev?.decision ?? 'admit'),
      reasons: admissionReasons,
      corrections: Array.isArray(prev?.corrections) ? prev!.corrections : [],
    };
  }
  base.admission_recheck = { at: nowIso, added: change.added, removed: change.removed };
  return base;
}
