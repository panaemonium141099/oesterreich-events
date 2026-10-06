import { describe, it, expect } from 'vitest';
import { coverageScope, planWithdrawals, probeGone, type SightingRow } from '@/lib/quality/withdrawal';

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

/** Sofort zurückzuziehen (Quelle tot) plus Kandidaten, die erst geprüft werden. */
const ids = (plan: ReturnType<typeof planWithdrawals>) =>
  [...plan.withdraw, ...plan.probe].map((w) => w.id).sort();
const probeIds = (plan: ReturnType<typeof planWithdrawals>) => plan.probe.map((w) => w.id).sort();

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
  it('schickt ein Event zur Prüfung, das ein späterer Besuch derselben Seite nicht mehr fand', () => {
    // Nicht gesehen ist kein Beleg: Stichprobe 2026-10-06, von 125 solchen
    // Kandidaten waren nur 15 an der Quelle wirklich weg (404/410).
    const gone = row({ id: 'gone', last_seen_at: daysAgo(8) });
    const plan = planWithdrawals([gone, ...visit()], { now: NOW });
    expect(plan.withdraw).toEqual([]);
    expect(probeIds(plan)).toEqual(['gone']);
    expect(plan.probe[0]).toMatchObject({ reason: 'missing_from_source', url: gone.source_url });
  });

  it('prüft nicht, wenn die URL eine Listen-Seite mehrerer Events ist', () => {
    const list = 'https://www.pill.gv.at/veranstaltungen';
    const gone = row({ id: 'gone', last_seen_at: daysAgo(20), source_url: list });
    const other = row({ source_url: list });
    expect(probeIds(planWithdrawals([gone, other, ...visit()], { now: NOW }))).toEqual([]);
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

});

describe('planWithdrawals — Quelle liefert gar nicht mehr', () => {
  it('zieht alle künftigen Events einer Quelle zurück, die seit 30 Tagen nichts geliefert hat', () => {
    const dead = [
      row({ id: 'd1', source_name: 'oeticket', source_url: 'https://www.oeticket.com/a', last_seen_at: daysAgo(150) }),
      row({ id: 'd2', source_name: 'oeticket', source_url: 'https://www.oeticket.com/b', last_seen_at: daysAgo(150) }),
    ];
    const plan = planWithdrawals([...dead, ...visit()], { now: NOW });
    expect(plan.withdraw.map((w) => w.id).sort()).toEqual(['d1', 'd2']);
    expect(plan.withdraw.every((w) => w.reason === 'source_dead')).toBe(true);
    expect(plan.probe).toEqual([]);
  });

  it('läuft der Scraper noch (findet nur nichts), wird erst geprüft statt sofort zurückgezogen', () => {
    // ticketmaster/events.at/oho.at liefen 2026-10-06 täglich und fanden
    // seit Mai nichts: kaputter Scraper, kein Beleg für abgesagte Events.
    const stale = row({ id: 't1', source_name: 'ticketmaster', source_url: 'https://www.ticketmaster.at/event/1', last_seen_at: daysAgo(150) });
    const plan = planWithdrawals([stale, ...visit()], { now: NOW, runningSources: new Set(['ticketmaster', 'gem2go']) });
    expect(plan.withdraw).toEqual([]);
    expect(plan.probe).toMatchObject([{ id: 't1', reason: 'source_dead', url: 'https://www.ticketmaster.at/event/1' }]);
  });

  it('greift nicht, wenn die ganze Pipeline steht (seit zwei Tagen nichts gesehen)', () => {
    const dead = row({ id: 'd1', source_name: 'oeticket', last_seen_at: daysAgo(150) });
    const stalled = visit({ last_seen_at: daysAgo(3) });
    expect(ids(planWithdrawals([dead, ...stalled], { now: NOW }))).toEqual([]);
  });
});

describe('probeGone — Beleg an der Quelle', () => {
  const res = (status: number) => ({ status }) as Response;

  it('weg ist nur, was nach allen Weiterleitungen 404 oder 410 liefert', async () => {
    const status: Record<string, number> = {
      'https://a.at/1': 404, 'https://b.at/1': 410, 'https://c.at/1': 200, 'https://d.at/1': 500, 'https://e.at/1': 403,
    };
    const gone = await probeGone(Object.keys(status), {
      fetchImpl: async (u) => res(status[String(u)]),
    });
    expect([...gone].sort()).toEqual(['https://a.at/1', 'https://b.at/1']);
  });

  it('Netzwerkfehler und Zeitüberschreitung gelten nicht als weg', async () => {
    const gone = await probeGone(['https://a.at/1'], {
      fetchImpl: async () => { throw new Error('ECONNRESET'); },
    });
    expect(gone.size).toBe(0);
  });

  it('fragt je Website nur eine Seite gleichzeitig ab und hält das Budget ein', async () => {
    let active = 0;
    let maxActive = 0;
    const calls: string[] = [];
    const urls = ['https://a.at/1', 'https://a.at/2', 'https://a.at/3', 'https://b.at/1'];
    await probeGone(urls, {
      budget: 3,
      hostDelayMs: 0,
      fetchImpl: async (u) => {
        const host = new URL(String(u)).host;
        calls.push(String(u));
        if (host === 'a.at') { active++; maxActive = Math.max(maxActive, active); }
        await new Promise((r) => setTimeout(r, 5));
        if (host === 'a.at') active--;
        return res(404);
      },
    });
    expect(maxActive).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it('gibt eine Website auf, die drei Mal in Folge keine verwertbare Antwort gibt (Bot-Sperre)', async () => {
    const calls: string[] = [];
    const urls = Array.from({ length: 10 }, (_, i) => `https://www.oeticket.com/e/${i}`);
    const gone = await probeGone([...urls, 'https://b.at/1'], {
      hostDelayMs: 0,
      fetchImpl: async (u) => {
        calls.push(String(u));
        if (String(u).includes('oeticket')) throw new Error('timeout');
        return res(404);
      },
    });
    expect(calls.filter((c) => c.includes('oeticket'))).toHaveLength(3);
    expect([...gone]).toEqual(['https://b.at/1']);
  });

  it('eine 200 setzt die Fehlerserie zurück', async () => {
    const seq = [500, 403, 200, 500, 429, 404];
    let i = 0;
    const urls = seq.map((_, k) => `https://a.at/${k}`);
    const gone = await probeGone(urls, { hostDelayMs: 0, fetchImpl: async () => res(seq[i++]) });
    expect([...gone]).toEqual(['https://a.at/5']);
  });
});
