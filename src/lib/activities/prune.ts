/**
 * Gruppen-Dedup / Canonical-Wahl / Prune fuer poi_activities
 * (fn-18, Task 2 — Epics E6 + E11). Pure Logik, vollstaendig getestet;
 * IO macht der Store (activity-store.ts).
 *
 * ── Begriffe (Epic E6, verbindlich) ─────────────────────────────────────────
 * full_attempt  = Lauf, der alle 131 Regionen VERSUCHT (auch mit Fehl-Regionen)
 * complete_run  = full_attempt mit 0 failed Regionen
 * run_seq       = EINZIGE Ordnungsquelle (Run-UUIDs sind nicht zeitlich ordbar)
 *
 * ── Liveness (E6/E11) ───────────────────────────────────────────────────────
 * Eine Row lebt, wenn ihre last_seen_complete_run_seq >= run_seq des
 * VORLETZTEN complete_run ist — NIE ueber last_seen_run_seq (das ist reine
 * Provenienz; ein Fehllauf-Sighting darf keinen POI am Leben halten).
 * Zusaetzlich gilt eine Row als lebendig, deren created_at NACH dem Start
 * des vorletzten complete_run liegt: solche Rows (Insert durch Fehl- oder
 * --region-Laeufe) hatten noch keine 2 kompletten Laeufe Gelegenheit,
 * gesehen zu werden — die Prune-Regel "in 2 kompletten Laeufen ungesehen"
 * ist fuer sie schlicht noch nicht erfuellbar. Ohne diesen Guard wuerde ein
 * Fehllauf seine EIGENEN frischen Inserts sofort wieder verstecken
 * (Task-AC: "simulierter Fehllauf versteckt keine Rows").
 * Bootstrap: existieren weniger als 2 complete_runs, ist ALLES lebendig
 * und Prune komplett deaktiviert.
 *
 * ── Canonical-Regel (E11, stabil-deterministisch) ───────────────────────────
 * Gruppe = gleicher content_fingerprint. Das bestehende Canonical BLEIBT,
 * solange es lebt. Nur wenn es tot ist, wird unter den lebenden Mitgliedern
 * neu gewaehlt: aeltestes created_at, bei Gleichstand lexikographisch
 * kleinste source_id. Das verhindert Canonical-Flapping/301-Churn bei
 * Mirror-Rows mit identischer run_seq (E5-Slug-Stabilitaet).
 * Recovery-Regel fuer kaputte Gruppen (mehrere oder null sichtbare Rows):
 * existiert genau EINE sichtbare lebende Row, ist sie Incumbent; sonst wird
 * Incumbency ignoriert und deterministisch gewaehlt.
 *
 * ── Gruppen-Prune (E6) ──────────────────────────────────────────────────────
 * visible=false fuer eine Gruppe NUR, wenn ALLE Mitglieder tot sind
 * (hoechste last_seen_complete_run_seq der Gruppe < Schwelle und kein
 * Young-Row-Guard greift). Tote Gruppen: duplicate_of ALLER Mitglieder wird
 * auf NULL geleert — tote Duplikat-URLs muessen 404 liefern, nicht via 301
 * wiederbeleben (Spiegelregel im Task-3-Resolver). Ein gesehenes Duplikat
 * haelt die Gruppe am Leben (Canonical wird umgewaehlt).
 */

export interface GroupMember {
  id: string;
  source_id: string;
  created_at: string;
  visible: boolean;
  duplicate_of: string | null;
  last_seen_complete_run_seq: number | null;
}

/** Liveness-Kontext eines Laufs. `null` = Bootstrap (<2 complete_runs). */
export interface LivenessContext {
  /** run_seq des VORLETZTEN complete_run (Prune-/Liveness-Schwelle). */
  thresholdSeq: number;
  /** started_at des vorletzten complete_run (Young-Row-Guard). */
  thresholdStartedAt: string;
}

export interface GroupUpdate {
  id: string;
  visible: boolean;
  duplicate_of: string | null;
}

/**
 * Liveness-Kontext aus den juengsten complete_runs (absteigend nach
 * run_seq sortiert erwartet). <2 Eintraege -> null (Bootstrap: alles lebt,
 * kein Prune).
 */
export function buildLivenessContext(
  completeRuns: Array<{ run_seq: number; started_at: string }>,
): LivenessContext | null {
  if (completeRuns.length < 2) return null;
  const sorted = [...completeRuns].sort((a, b) => b.run_seq - a.run_seq);
  const secondLatest = sorted[1];
  return { thresholdSeq: secondLatest.run_seq, thresholdStartedAt: secondLatest.started_at };
}

/** Lebt die Row? AUSSCHLIESSLICH ueber last_seen_complete_run_seq +
 *  Young-Row-Guard — nie ueber last_seen_run_seq (reine Provenienz). */
export function isMemberAlive(member: GroupMember, ctx: LivenessContext | null): boolean {
  if (ctx === null) return true; // Bootstrap
  if (
    member.last_seen_complete_run_seq !== null &&
    member.last_seen_complete_run_seq >= ctx.thresholdSeq
  ) {
    return true;
  }
  // Young-Row-Guard: juenger als der Start des vorletzten complete_run ->
  // hatte noch keine 2 kompletten Laeufe Gelegenheit, gesehen zu werden.
  return member.created_at > ctx.thresholdStartedAt;
}

/** Deterministisch kleinstes Mitglied: aeltestes created_at, dann
 *  lexikographisch kleinste source_id (E11-Neuwahl-Reihenfolge). */
function deterministicPick(members: GroupMember[]): GroupMember {
  return members.reduce((best, m) => {
    if (m.created_at < best.created_at) return m;
    if (m.created_at === best.created_at && m.source_id < best.source_id) return m;
    return best;
  });
}

/**
 * Canonical-Wahl einer Fingerprint-Gruppe nach E11 (inkl. Recovery-Regel):
 *  - Incumbent = die EINE sichtbare Row (konsistente Gruppe). Lebt sie,
 *    bleibt sie Canonical — keine Neuwahl, kein 301-Churn.
 *  - Sonst (Incumbent tot, oder kaputte Gruppe mit mehreren/null sichtbaren
 *    Rows): deterministische Neuwahl unter den LEBENDEN Mitgliedern.
 *  - Leben keine Mitglieder: bleibt ein toter Incumbent Canonical (stabil —
 *    die Gruppe wird ohnehin nur vom Prune versteckt, nicht vom Reconcile);
 *    ohne eindeutigen Incumbent deterministische Wahl unter allen.
 */
export function chooseCanonical(members: GroupMember[], ctx: LivenessContext | null): GroupMember {
  if (members.length === 1) return members[0];

  const visible = members.filter((m) => m.visible);
  const incumbent = visible.length === 1 ? visible[0] : null;
  if (incumbent && isMemberAlive(incumbent, ctx)) return incumbent;

  const alive = members.filter((m) => isMemberAlive(m, ctx));
  if (alive.length > 0) return deterministicPick(alive);
  if (incumbent) return incumbent;
  return deterministicPick(members);
}

/**
 * Rekonsolidierung einer Gruppe: genau EIN sichtbares Canonical
 * (visible=true, duplicate_of=null), alle anderen Mitglieder
 * visible=false + duplicate_of=<canonical.id>. Liefert nur die
 * tatsaechlich zu aendernden Rows.
 *
 * Ausnahme: eine TOTE Gruppe ohne ein einziges sichtbares Mitglied ist
 * (ggf. teilweise) GEPRUNT — Reconcile darf sie NIE wiederbeleben
 * (sonst wuerde --reconcile geprunte Gruppen resurrecten). Stattdessen
 * wird der Prune-Zielzustand vervollstaendigt (duplicate_of leeren —
 * Crash-Recovery nach Abbruch mitten im Prune).
 */
export function reconcileGroup(members: GroupMember[], ctx: LivenessContext | null): GroupUpdate[] {
  if (members.length === 0) return [];

  if (isGroupDead(members, ctx) && members.every((m) => !m.visible)) {
    const updates: GroupUpdate[] = [];
    for (const m of members) {
      if (m.duplicate_of !== null) {
        updates.push({ id: m.id, visible: false, duplicate_of: null });
      }
    }
    return updates;
  }

  const canonical = chooseCanonical(members, ctx);

  const updates: GroupUpdate[] = [];
  for (const m of members) {
    const wantVisible = m.id === canonical.id;
    const wantDuplicateOf = m.id === canonical.id ? null : canonical.id;
    if (m.visible !== wantVisible || m.duplicate_of !== wantDuplicateOf) {
      updates.push({ id: m.id, visible: wantVisible, duplicate_of: wantDuplicateOf });
    }
  }
  return updates;
}

/** Ist die GANZE Gruppe tot (kein einziges lebendes Mitglied)?
 *  Im Bootstrap (ctx null) nie. */
export function isGroupDead(members: GroupMember[], ctx: LivenessContext | null): boolean {
  if (ctx === null) return false;
  return members.every((m) => !isMemberAlive(m, ctx));
}

/**
 * Prune-Entscheidung fuer eine Kandidaten-Gruppe:
 *  - Gruppe komplett tot -> ALLE Mitglieder visible=false UND
 *    duplicate_of=NULL (tote Duplikat-URLs -> 404, kein 301-Wiederbeleben).
 *  - Sonst -> normale Rekonsolidierung (Canonical ggf. auf ein lebendes
 *    Mitglied umwaehlen — ein gesehenes Duplikat haelt die Gruppe am Leben).
 * Liefert nur tatsaechlich zu aendernde Rows. Bei ctx === null (Bootstrap)
 * wird NIE geprunt.
 */
export function pruneGroup(members: GroupMember[], ctx: LivenessContext | null): GroupUpdate[] {
  if (ctx === null) return [];
  if (!isGroupDead(members, ctx)) {
    return reconcileGroup(members, ctx);
  }
  const updates: GroupUpdate[] = [];
  for (const m of members) {
    if (m.visible !== false || m.duplicate_of !== null) {
      updates.push({ id: m.id, visible: false, duplicate_of: null });
    }
  }
  return updates;
}

/** Gruppiert Member-Rows nach content_fingerprint. */
export function groupByFingerprint<T extends { content_fingerprint: string }>(
  rows: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.content_fingerprint);
    if (list) list.push(row);
    else groups.set(row.content_fingerprint, [row]);
  }
  return groups;
}
