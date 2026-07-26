import { describe, it, expect } from 'vitest';
import {
  buildLivenessContext,
  isMemberAlive,
  chooseCanonical,
  reconcileGroup,
  isGroupDead,
  pruneGroup,
  groupByFingerprint,
  type GroupMember,
  type LivenessContext,
} from '@/lib/activities/prune';

function member(overrides: Partial<GroupMember> & { id: string }): GroupMember {
  return {
    source_id: overrides.id,
    created_at: '2026-01-01T00:00:00.000Z',
    visible: true,
    duplicate_of: null,
    last_seen_complete_run_seq: null,
    ...overrides,
  };
}

/** Schwelle = vorletzter complete_run: run_seq 5, gestartet 2026-06-01. */
const CTX: LivenessContext = { thresholdSeq: 5, thresholdStartedAt: '2026-06-01T00:00:00.000Z' };

describe('buildLivenessContext (Epic E6)', () => {
  it('<2 complete_runs -> null (Bootstrap: alles lebt, kein Prune)', () => {
    expect(buildLivenessContext([])).toBeNull();
    expect(buildLivenessContext([{ run_seq: 7, started_at: 'x' }])).toBeNull();
  });

  it('Schwelle = run_seq des VORLETZTEN complete_run (Ordnung ueber run_seq, nie UUIDs)', () => {
    const ctx = buildLivenessContext([
      { run_seq: 3, started_at: '2026-03-01T00:00:00.000Z' },
      { run_seq: 9, started_at: '2026-09-01T00:00:00.000Z' },
      { run_seq: 7, started_at: '2026-07-01T00:00:00.000Z' },
    ]);
    expect(ctx).toEqual({ thresholdSeq: 7, thresholdStartedAt: '2026-07-01T00:00:00.000Z' });
  });
});

describe('isMemberAlive — Liveness AUSSCHLIESSLICH ueber last_seen_complete_run_seq', () => {
  it('Bootstrap (ctx null): alles lebt', () => {
    expect(isMemberAlive(member({ id: 'a' }), null)).toBe(true);
  });

  it('in einem der letzten 2 complete_runs gesehen -> lebt', () => {
    expect(isMemberAlive(member({ id: 'a', last_seen_complete_run_seq: 5 }), CTX)).toBe(true);
    expect(isMemberAlive(member({ id: 'a', last_seen_complete_run_seq: 6 }), CTX)).toBe(true);
  });

  it('2 complete_runs ungesehen -> tot (alte Row)', () => {
    expect(isMemberAlive(member({ id: 'a', last_seen_complete_run_seq: 4 }), CTX)).toBe(false);
    expect(isMemberAlive(member({ id: 'a', last_seen_complete_run_seq: null }), CTX)).toBe(false);
  });

  it('Fehllauf-Sighting haelt keinen POI am Leben: last_seen_run_seq existiert im ' +
     'Liveness-Modell strukturell gar nicht — nur last_seen_complete_run_seq zaehlt', () => {
    // GroupMember hat bewusst KEIN last_seen_run_seq-Feld: ein noch so
    // frisches Fehllauf-Sighting kann die Bewertung nicht beeinflussen.
    const m = member({ id: 'a', last_seen_complete_run_seq: 2 });
    expect('last_seen_run_seq' in m).toBe(false);
    expect(isMemberAlive(m, CTX)).toBe(false);
  });

  it('Young-Row-Guard: nach dem Start des vorletzten complete_run erzeugte Rows leben ' +
     '(hatten noch keine 2 kompletten Laeufe Gelegenheit)', () => {
    const young = member({ id: 'a', created_at: '2026-06-15T00:00:00.000Z' });
    expect(isMemberAlive(young, CTX)).toBe(true);
    const old = member({ id: 'a', created_at: '2026-05-01T00:00:00.000Z' });
    expect(isMemberAlive(old, CTX)).toBe(false);
  });
});

describe('chooseCanonical — E11-Regel (stabil-deterministisch)', () => {
  it('lebendes Canonical BLEIBT, auch wenn ein aelteres Mitglied existiert (kein Flapping)', () => {
    const incumbent = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    const older = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: false, duplicate_of: 'b', last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([older, incumbent], CTX).id).toBe('b');
  });

  it('totes Canonical -> Neuwahl unter den LEBENDEN: aeltestes created_at', () => {
    const dead = member({ id: 'c', source_id: 'c', visible: true, last_seen_complete_run_seq: 2 });
    const aliveNew = member({ id: 'b', source_id: 'b', created_at: '2026-03-01T00:00:00.000Z', visible: false, duplicate_of: 'c', last_seen_complete_run_seq: 6 });
    const aliveOld = member({ id: 'a', source_id: 'a', created_at: '2026-02-01T00:00:00.000Z', visible: false, duplicate_of: 'c', last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([dead, aliveNew, aliveOld], CTX).id).toBe('a');
  });

  it('Gleichstand bei created_at -> lexikographisch kleinste source_id', () => {
    const t = '2026-02-01T00:00:00.000Z';
    const m1 = member({ id: 'x', source_id: 'guid-b', created_at: t, visible: false, last_seen_complete_run_seq: 6 });
    const m2 = member({ id: 'y', source_id: 'guid-a', created_at: t, visible: false, last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([m1, m2], CTX).source_id).toBe('guid-a');
  });

  it('Recovery-Regel: mehrere sichtbare Rows -> Incumbency ignoriert, deterministische Wahl', () => {
    const v1 = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    const v2 = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([v1, v2], CTX).id).toBe('a');
  });

  it('Recovery-Regel: genau EINE sichtbare LEBENDE Row ist Incumbent — auch in kaputten Gruppen mit weiteren sichtbaren toten Rows', () => {
    // Kaputte Gruppe nach Crash: sichtbare tote Row + sichtbare lebende Row
    // + verstecktes aelteres lebendes Duplikat. Die sichtbare lebende Row
    // bleibt Canonical (kein Redirect-Churn auf das versteckte Mitglied).
    const visibleDead = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 2 });
    const visibleAlive = member({ id: 'b', source_id: 'b', created_at: '2026-03-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    const hiddenAlive = member({ id: 'c', source_id: 'c', created_at: '2026-02-01T00:00:00.000Z', visible: false, duplicate_of: 'a', last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([visibleDead, visibleAlive, hiddenAlive], CTX).id).toBe('b');
  });

  it('Recovery-Regel: null sichtbare Rows -> deterministische Wahl', () => {
    const m1 = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: false, last_seen_complete_run_seq: 6 });
    const m2 = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: false, last_seen_complete_run_seq: 6 });
    expect(chooseCanonical([m1, m2], CTX).id).toBe('a');
  });

  it('alle tot + eindeutiger Incumbent -> Incumbent bleibt (kein 301-Churn vor dem Prune)', () => {
    const deadIncumbent = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 1 });
    const deadOther = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: false, duplicate_of: 'b', last_seen_complete_run_seq: 1 });
    expect(chooseCanonical([deadIncumbent, deadOther], CTX).id).toBe('b');
  });
});

describe('reconcileGroup — genau EIN sichtbares Canonical pro Gruppe', () => {
  it('haengt Duplikate aufs Canonical um und liefert nur Aenderungen', () => {
    const canonical = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    const dupe = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 6 });
    const updates = reconcileGroup([canonical, dupe], CTX);
    expect(updates).toEqual([{ id: 'b', visible: false, duplicate_of: 'a' }]);
  });

  it('ist idempotent: konsistente Gruppe -> keine Updates (Canonical-Stabilitaet ueber Laeufe)', () => {
    const canonical = member({ id: 'a', source_id: 'a', visible: true, last_seen_complete_run_seq: 6 });
    const dupe = member({ id: 'b', source_id: 'b', visible: false, duplicate_of: 'a', last_seen_complete_run_seq: 6 });
    expect(reconcileGroup([canonical, dupe], CTX)).toEqual([]);
    // Mehrere "Laeufe" hintereinander: weiterhin keine Aenderung -> kein 301-Churn.
    expect(reconcileGroup([canonical, dupe], CTX)).toEqual([]);
  });

  it('Einzel-Row-Gruppe: unsichtbar gewordene LEBENDE Row mit geloeschtem duplicate_of wird wieder sichtbar', () => {
    const solo = member({ id: 'a', source_id: 'a', visible: false, duplicate_of: 'ghost', last_seen_complete_run_seq: 6 });
    expect(reconcileGroup([solo], CTX)).toEqual([{ id: 'a', visible: true, duplicate_of: null }]);
  });

  it('geprunte tote Gruppe wird von Reconcile NIE wiederbelebt (--reconcile-sicher)', () => {
    const a = member({ id: 'a', source_id: 'a', visible: false, duplicate_of: null, last_seen_complete_run_seq: 1 });
    const b = member({ id: 'b', source_id: 'b', visible: false, duplicate_of: null, last_seen_complete_run_seq: 1 });
    expect(reconcileGroup([a, b], CTX)).toEqual([]);
  });

  it('teilweise geprunte tote Gruppe: Reconcile vervollstaendigt den Prune (duplicate_of leeren)', () => {
    const a = member({ id: 'a', source_id: 'a', visible: false, duplicate_of: null, last_seen_complete_run_seq: 1 });
    const b = member({ id: 'b', source_id: 'b', visible: false, duplicate_of: 'a', last_seen_complete_run_seq: 1 });
    expect(reconcileGroup([a, b], CTX)).toEqual([{ id: 'b', visible: false, duplicate_of: null }]);
  });
});

describe('pruneGroup — Gruppen-Prune (E6)', () => {
  it('Bootstrap (ctx null): es wird NIE geprunt', () => {
    const dead = member({ id: 'a', source_id: 'a', last_seen_complete_run_seq: null });
    expect(pruneGroup([dead], null)).toEqual([]);
    expect(isGroupDead([dead], null)).toBe(false);
  });

  it('EIN lebendes Duplikat haelt die Gruppe am Leben — Canonical wird umgewaehlt', () => {
    const deadCanonical = member({ id: 'a', source_id: 'a', created_at: '2026-01-01T00:00:00.000Z', visible: true, last_seen_complete_run_seq: 2 });
    const aliveDupe = member({ id: 'b', source_id: 'b', created_at: '2026-02-01T00:00:00.000Z', visible: false, duplicate_of: 'a', last_seen_complete_run_seq: 6 });
    expect(isGroupDead([deadCanonical, aliveDupe], CTX)).toBe(false);
    const updates = pruneGroup([deadCanonical, aliveDupe], CTX);
    expect(updates).toContainEqual({ id: 'b', visible: true, duplicate_of: null });
    expect(updates).toContainEqual({ id: 'a', visible: false, duplicate_of: 'b' });
  });

  it('erst wenn ALLE Mitglieder tot sind, wird die Gruppe unsichtbar — duplicate_of wird geleert (404, kein 301)', () => {
    const deadCanonical = member({ id: 'a', source_id: 'a', visible: true, last_seen_complete_run_seq: 3 });
    const deadDupe = member({ id: 'b', source_id: 'b', visible: false, duplicate_of: 'a', last_seen_complete_run_seq: 4 });
    expect(isGroupDead([deadCanonical, deadDupe], CTX)).toBe(true);
    const updates = pruneGroup([deadCanonical, deadDupe], CTX);
    expect(updates).toContainEqual({ id: 'a', visible: false, duplicate_of: null });
    expect(updates).toContainEqual({ id: 'b', visible: false, duplicate_of: null });
    expect(updates).toHaveLength(2);
  });

  it('bereits fertig geprunte Gruppe -> keine Updates (idempotent)', () => {
    const a = member({ id: 'a', source_id: 'a', visible: false, duplicate_of: null, last_seen_complete_run_seq: 1 });
    const b = member({ id: 'b', source_id: 'b', visible: false, duplicate_of: null, last_seen_complete_run_seq: 1 });
    expect(pruneGroup([a, b], CTX)).toEqual([]);
  });
});

describe('groupByFingerprint', () => {
  it('gruppiert Rows nach content_fingerprint', () => {
    const rows = [
      { content_fingerprint: 'f1', id: 'a' },
      { content_fingerprint: 'f2', id: 'b' },
      { content_fingerprint: 'f1', id: 'c' },
    ];
    const groups = groupByFingerprint(rows);
    expect(groups.size).toBe(2);
    expect(groups.get('f1')!.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
