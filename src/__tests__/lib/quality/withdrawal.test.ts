import { describe, it, expect } from 'vitest';
import { coverageScope, planWithdrawals, type SightingRow } from '@/lib/quality/withdrawal';

const NOW = new Date('2026-10-06T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

let seq = 0;
function row(p: Partial<SightingRow> = {}): SightingRow {
  seq++;
  return {
    id: p.id ?? `e${seq}`,
    source_name: 'gem2go',
    source_url: `https://www.pill.gv.at/veranstaltung/${seq}`,
    start_date: inDays(10),
    last_seen_at: daysAgo(0),
    publish_status: 'published',
    duplicate_of: null,
    ...p,
  };
}

/** Drei Termine, die der letzte Besuch der Seite gesehen hat (bis in 30 Tagen). */
function visit(p: Partial<SightingRow> = {}): SightingRow[] {
  return [row({ start_date: inDays(5), ...p }), row({ start_date: inDays(15), ...p }), row({ start_date: inDays(30), ...p })];
}

const ids = (plan: ReturnType<typeof planWithdrawals>) => plan.withdraw.map((w) => w.id).sort();

describe('coverageScope', () => {
  it('ist die Domain der Quell-URL, ohne www und Grossschreibung', () => {
    expect(coverageScope(row({ source_url: 'https://WWW.Pill.gv.at/x?y=1' }))).toBe('gem2go|pill.gv.at');
    expect(coverageScope(row({ source_url: null }))).toBe('gem2go|');
  });

  it('trennt veranstaltungskalender.net nach Region (eigene Seitenobergrenze je Region)', () => {
    const a = row({ source_name: 'veranstaltungskalender.net', source_url: 'https://www.veranstaltungskalender.net/wien/penzing-14-bezirk/x.html' });
    const b = row({ source_name: 'veranstaltungskalender.net', source_url: 'https://www.veranstaltungskalender.net/oberoesterreich/gmunden/y.html' });
    expect(coverageScope(a)).toBe('veranstaltungskalender.net|veranstaltungskalender.net/wien');
    expect(coverageScope(b)).toBe('veranstaltungskalender.net|veranstaltungskalender.net/oberoesterreich');
  });
});

describe('planWithdrawals — Quelle hat neu gelistet, Event fehlte', () => {
  it('zieht ein Event zurück, das ein späterer Besuch derselben Seite nicht mehr fand', () => {
    const gone = row({ id: 'gone', last_seen_at: daysAgo(8) });
    const plan = planWithdrawals([gone, ...visit()], { now: NOW });
    expect(ids(plan)).toEqual(['gone']);
    expect(plan.withdraw[0].reason).toBe('missing_from_source');
  });

  it('wartet sieben Tage nach der letzten Sichtung', () => {
    const recent = row({ id: 'recent', last_seen_at: daysAgo(6) });
    expect(ids(planWithdrawals([recent, ...visit()], { now: NOW }))).toEqual([]);
  });

  it('lässt Termine hinter dem Datums-Horizont des letzten Besuchs stehen (Seitenobergrenze)', () => {
    const far = row({ id: 'far', start_date: inDays(60), last_seen_at: daysAgo(20) });
    expect(ids(planWithdrawals([far, ...visit()], { now: NOW }))).toEqual([]);
  });

  it('braucht mindestens drei Termine im letzten Besuch als Beleg', () => {
    const gone = row({ id: 'gone', last_seen_at: daysAgo(20) });
    const thin = visit().slice(0, 2);
    expect(ids(planWithdrawals([gone, ...thin], { now: NOW }))).toEqual([]);
  });

  it('zählt nur Besuche derselben Gemeinde-Website', () => {
    const gone = row({ id: 'gone', last_seen_at: daysAgo(20), source_url: 'https://www.duens.at/v/1' });
    expect(ids(planWithdrawals([gone, ...visit()], { now: NOW }))).toEqual([]);
  });

  it('lässt einen Primary stehen, solange ein Duplikat einer anderen Quelle noch gelistet ist', () => {
    const primary = row({ id: 'primary', last_seen_at: daysAgo(20) });
    const dup = row({ id: 'dup', source_name: 'falter', publish_status: 'duplicate', duplicate_of: 'primary' });
    expect(ids(planWithdrawals([primary, dup, ...visit()], { now: NOW }))).toEqual([]);
  });

  it('zieht den Primary zurück, wenn auch das Duplikat nicht mehr gesehen wird', () => {
    const primary = row({ id: 'primary', last_seen_at: daysAgo(20) });
    const dup = row({ id: 'dup', source_name: 'falter', publish_status: 'duplicate', duplicate_of: 'primary', last_seen_at: daysAgo(20) });
    expect(ids(planWithdrawals([primary, dup, ...visit()], { now: NOW }))).toEqual(['primary']);
  });

  it('fasst vergangene und nicht sichtbare Events nicht an', () => {
    const past = row({ id: 'past', start_date: daysAgo(1), last_seen_at: daysAgo(20) });
    const review = row({ id: 'review', publish_status: 'needs_review', last_seen_at: daysAgo(20) });
    expect(ids(planWithdrawals([past, review, ...visit()], { now: NOW }))).toEqual([]);
  });

  it('überspringt eine Seite, auf der mehr als die Hälfte verschwinden würde (Scraper kaputt)', () => {
    const gone = Array.from({ length: 6 }, (_, i) => row({ id: `g${i}`, last_seen_at: daysAgo(20) }));
    const plan = planWithdrawals([...gone, ...visit()], { now: NOW });
    expect(ids(plan)).toEqual([]);
    expect(plan.skippedScopes).toEqual([
      { source_name: 'gem2go', scope: 'gem2go|pill.gv.at', candidates: 6, visible: 9 },
    ]);
  });
});

describe('planWithdrawals — Quelle liefert gar nicht mehr', () => {
  it('zieht alle künftigen Events einer Quelle zurück, die seit 30 Tagen nichts geliefert hat', () => {
    const dead = [
      row({ id: 'd1', source_name: 'oeticket', source_url: 'https://www.oeticket.com/a', last_seen_at: daysAgo(150) }),
      row({ id: 'd2', source_name: 'oeticket', source_url: 'https://www.oeticket.com/b', last_seen_at: daysAgo(150) }),
    ];
    const plan = planWithdrawals([...dead, ...visit()], { now: NOW });
    expect(ids(plan)).toEqual(['d1', 'd2']);
    expect(plan.withdraw.every((w) => w.reason === 'source_dead')).toBe(true);
  });

  it('greift nicht, wenn die ganze Pipeline steht (seit zwei Tagen nichts gesehen)', () => {
    const dead = row({ id: 'd1', source_name: 'oeticket', last_seen_at: daysAgo(150) });
    const stalled = visit({ last_seen_at: daysAgo(3) });
    expect(ids(planWithdrawals([dead, ...stalled], { now: NOW }))).toEqual([]);
  });
});
