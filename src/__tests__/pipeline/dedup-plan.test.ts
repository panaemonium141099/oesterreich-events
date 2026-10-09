// src/__tests__/pipeline/dedup-plan.test.ts
//
// Der Dedup rechnet jede Nacht den Sollzustand aus den aktuellen Daten neu
// und schreibt nur die Abweichungen. Gleiche Daten → gleiches Ergebnis,
// unabhängig davon, was frühere Läufe (oder frühere Regeln) markiert haben.

import { describe, it, expect } from 'vitest';
import { dedupDay } from '@/lib/pipeline/dedup-engine';
import { planDedup, releaseStatus, checkSafetyValve, dropDependentsOfFailedReleases, resolvePlanConflicts } from '@/lib/pipeline/dedup-plan';
import type { EventRow } from '@/lib/pipeline/types';

const PLACE = { location_name: 'Sargfabrik', postal_code: '1140', latitude: 48.1952, longitude: 16.3046, location_precision: 'building' };
const ev = (o: Partial<EventRow> & { id: string; source_name: string }): EventRow =>
  ({ title: 'Konzert X', start_date: '2026-10-07T17:30:00Z', publish_status: 'published', source_id: o.id, quality_score: 70, ...PLACE, ...o }) as EventRow;

let n = 0;
const newId = () => `cluster-${++n}`;

function plan(events: EventRow[]) {
  return planDedup(events, dedupDay(events).clusters, { newClusterId: newId });
}

describe('planDedup', () => {
  it('neuer Cluster: Duplikat zeigt auf den Primary', () => {
    const p = plan([ev({ id: 'a', source_name: 'falter' }), ev({ id: 'b', source_name: 'Eventim' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'a', primaryId: 'b' })]);
    expect(p.release).toEqual([]);
  });

  it('bereits richtiger Zustand: keine Schreibvorgänge (idempotent)', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'falter', publish_status: 'duplicate', duplicate_of: 'b', dedup_cluster_id: 'c1' }),
      ev({ id: 'b', source_name: 'Eventim', dedup_cluster_id: 'c1' }),
    ]);
    expect(p.markDuplicate).toEqual([]);
    expect(p.release).toEqual([]);
    expect(p.primaries).toEqual([]);
  });

  it('Eventim kommt später dazu: wird Primary, alte Duplikate zeigen um', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'falter', dedup_cluster_id: 'c1' }),
      ev({ id: 'd', source_name: 'partytimer', publish_status: 'duplicate', duplicate_of: 'a', dedup_cluster_id: 'c1' }),
      ev({ id: 'e', source_name: 'Eventim' }),
    ]);
    const byId = new Map(p.markDuplicate.map(m => [m.id, m.primaryId]));
    expect(byId.get('a')).toBe('e');
    expect(byId.get('d')).toBe('e');
    // Cluster-Id bleibt stabil.
    expect(new Set(p.markDuplicate.map(m => m.clusterId))).toEqual(new Set(['c1']));
  });

  it('Rollentausch: der freigegebene neue Primary behält die Cluster-Id (die Freigabe setzt sie sonst auf null)', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'Eventim', publish_status: 'duplicate', duplicate_of: 'b', dedup_cluster_id: 'c1' }),
      ev({ id: 'b', source_name: 'falter', dedup_cluster_id: 'c1' }),
    ]);
    expect(p.primaries).toEqual([expect.objectContaining({ id: 'a', clusterId: 'c1' })]);
  });

  it('Primary bekommt fehlende Felder aus den Duplikaten (Wiederholung je Lauf)', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'wien-ticket', organizer: 'Sargfabrik', publish_status: 'duplicate', duplicate_of: 'b', dedup_cluster_id: 'c1' }),
      ev({ id: 'b', source_name: 'Eventim', organizer: null, dedup_cluster_id: 'c1' }),
    ]);
    expect(p.primaries).toEqual([{ id: 'b', clusterId: 'c1', enrichments: { organizer: 'Sargfabrik' } }]);
  });
});

describe('planDedup: Freigabe nur mit Gegenbeleg', () => {
  // Bestehende Verbindungen stammen aus früheren Läufen. Sie werden nur
  // gelöst, wenn die Daten jetzt klar zwei Events zeigen — sonst würden
  // Altzeilen, die der alte Dedup versteckt hatte, als Phantome auftauchen.
  const SEEN = '2026-10-07T03:00:00Z';
  const lastSeen = new Map([['falter', SEEN], ['Eventim', SEEN], ['q', SEEN]]);
  const planWith = (events: EventRow[], external = new Map<string, EventRow>()) =>
    planDedup(events, dedupDay(events, { sourceLastSeen: lastSeen }).clusters, { newClusterId: newId, sourceLastSeen: lastSeen, externalPrimaries: external });
  const dup = (o: Partial<EventRow>) =>
    ev({ publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN, ...o, id: 'a', source_name: 'falter' });
  const primary = (o: Partial<EventRow> = {}) =>
    ev({ last_seen_at: SEEN, ...o, id: 'b', source_name: 'Eventim' });

  it('ältere Fassung einer Seite (staleIds) bleibt verborgen wie eine verwaiste Zeile', () => {
    const events = [dup({ title: 'Ganz anderes Event' }), primary()];
    const stale = new Set(['a']);
    const p = planDedup(events, dedupDay(events, { sourceLastSeen: lastSeen, staleIds: stale }).clusters,
      { newClusterId: newId, sourceLastSeen: lastSeen, staleIds: stale });
    expect(p.release).toEqual([]);
  });

  it('ganz anderer Titel am selben Ort: zwei Events, freigeben', () => {
    const p = planWith([dup({ title: 'Ganz anderes Event' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_title' })]);
  });

  it('andere Vorstellung (über 2 h): freigeben', () => {
    const p = planWith([dup({ start_date: '2026-10-07T12:00:00Z' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_showtime' })]);
  });

  it('nur abweichendes PLZ-Etikett ist kein Gegenbeleg', () => {
    const p = planWith([
      dup({ postal_code: '5592', latitude: null, longitude: null, location_precision: null, location_name: 'Lessach' }),
      primary({ postal_code: '5575', latitude: null, longitude: null, location_precision: null, location_name: 'Lessach' }),
    ]);
    expect(p.release).toEqual([]);
  });

  it.each(['zum Footer', 'Springe zum Hauptinhalt', 'Skip to content'])(
    'Navigations-Müll derselben Quelle bleibt verborgen: %s',
    (title) => {
      const p = planWith([
        ev({ id: 'a', source_name: 'q', title, publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN }),
        ev({ id: 'b', source_name: 'q', title: 'Herbstfest', last_seen_at: SEEN }),
      ]);
      expect(p.release).toEqual([]);
    },
  );

  // Abschlussprüfung 2026-10-08: 37 frische Paare derselben Quelle mit
  // anderem Titel hingen zusammen („Halloween Gruseldinner" hinter
  // „Halloween Fest", „Maxiklänge" hinter „Babyklänge").
  it('gleiche Quelle, anderer Titel (beide echt): zwei Programmpunkte, freigeben', () => {
    const p = planWith([
      ev({ id: 'a', source_name: 'q', title: 'Halloween Gruseldinner', publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN }),
      ev({ id: 'b', source_name: 'q', title: 'Halloween Fest', last_seen_at: SEEN }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'same_source_other_title' })]);
  });

  it('Etiketten-Widerspruch und auch sonst kein gemeinsamer Ort: freigeben (Nachbarpfarren)', () => {
    const p = planWith([
      dup({ title: 'Jahresschlussgottesdienst', location_name: 'Pfarrkirche Altlichtenwarth', postal_code: '2144', latitude: null, longitude: null, location_precision: null }),
      primary({ title: 'Jahresschlussgottesdienst', location_name: 'Pfarrkirche Velm-Götzendorf', postal_code: '2245', latitude: null, longitude: null, location_precision: null }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a' })]);
  });

  it('nur Etiketten widersprechen, der Venue-Name ist bloß ein Gattungswort: freigeben', () => {
    const noPin = { latitude: null, longitude: null, location_precision: null };
    const p = planWith([
      dup({ title: 'Jahresschlussgottesdienst', location_name: 'Pfarrkirche', postal_code: '2144', ...noPin }),
      primary({ title: 'Jahresschlussgottesdienst', location_name: 'Pfarrkirche', postal_code: '2245', ...noPin }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_gemeinde' })]);
  });

  it('Zeile ohne echten Titel („Samstag, , 10:00") wird nicht wieder sichtbar', () => {
    const otherDay = primary({ start_date: '2026-10-14T17:30:00Z' });
    const p = planWith([dup({ title: 'Samstag,\n\n, 10:00' })], new Map([['b', otherDay]]));
    expect(p.release).toEqual([]);
  });

  it('Rotation der Gemeinde-Aggregatoren (bis 14 Tage nicht gesehen) ist nicht verwaist', () => {
    const p = planWith([dup({ start_date: '2026-10-07T12:00:00Z', last_seen_at: '2026-09-25T03:00:00Z' }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_showtime' })]);
  });

  it('verwaiste Zeile wird nicht wieder sichtbar (Zeitzonen-Altlast)', () => {
    const p = planWith([dup({ start_date: '2026-10-07T19:30:00Z', last_seen_at: '2026-08-20T03:00:00Z' }), primary()]);
    expect(p.release).toEqual([]);
  });

  // Prod 2026-10-08: 433 künftige frische Zeilen hingen an verwaisten
  // Primaries (Quelle listet sie nicht mehr, oft mit Zeitzonen-Versatz oder
  // schon vorbei). Die Verbindung blieb, weil verwaiste Zeilen kein
  // Gegenbeleg sind: frische Termine waren an ihrem Tag unsichtbar.
  const ORPHAN_SEEN = '2026-08-20T03:00:00Z';

  it('verwaister Primary am selben Tag: Verbindung bleibt, die frische Zeile wird Primary', () => {
    const p = planWith([dup({}), primary({ start_date: '2026-10-07T15:30:00Z', last_seen_at: ORPHAN_SEEN })]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_of_cluster' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'b', primaryId: 'a' })]);
  });

  // Gegenprüfung 2026-10-09: Ist die frische Zeile zurückgehalten (Ortskonflikt,
  // Quarantäne), darf die verborgene Altzeile nicht an ihrer Stelle mit
  // veralteten Daten sichtbar werden.
  it('kein frisches sichtbares Mitglied: verborgene Altzeile bleibt verborgen', () => {
    const p = planWith([
      dup({ last_seen_at: ORPHAN_SEEN }),
      primary({ publish_status: 'needs_review', location_status: 'conflict' }),
    ]);
    expect(p.release).toEqual([]);
    expect(p.markDuplicate).toEqual([]);
  });

  it('Inserat (business) hinter einem zurückgezogenen Primary wird freigegeben, auch ohne frische Sichtung', () => {
    const withdrawn = primary({ publish_status: 'suppressed', withdrawn_at: '2026-10-07T04:00:00Z' } as Partial<EventRow>);
    const p = planWith([dup({ source_type: 'business', last_seen_at: '2026-09-11T03:00:00Z' } as Partial<EventRow>)], new Map([['b', withdrawn]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  // Stichprobe 2026-10-09: gem2go führt hunderte Gemeinden unter einem
  // Quellennamen. Die Altzeile „Jahreshauptversammlung - OGV Grinzens"
  // wurde als Vorgängerversion der Kematener JHV verstanden.
  it('Vorgängerversion nur von derselben Seite oder demselben Ort, nicht aus einer anderen Gemeinde', () => {
    const orphan = ev({ id: 'o', source_name: 'q', title: 'Jahreshauptversammlung', last_seen_at: ORPHAN_SEEN,
      source_url: 'https://www.grinzens.gv.at/jhv', location_name: 'Gemeinderäume', postal_code: '6095', latitude: 47.23, longitude: 11.25 });
    const fresh = ev({ id: 'f', source_name: 'q', title: 'Jahreshauptversammlung', last_seen_at: SEEN,
      source_url: 'https://www.kematen-krems.at/jhv', location_name: "Green's Restaurant", postal_code: '4531', latitude: 48.11, longitude: 14.19 });
    const r = dedupDay([orphan, fresh], { sourceLastSeen: lastSeen });
    expect(r.clusters).toEqual([]);
  });

  it('Vorgängerversion derselben Seite mit +1 h (Zeitzonen-Altlast) wird verborgen, auch bei mehreren gleichnamigen Zeilen anderswo', () => {
    const url = 'https://www.alkoven.at/Kinderweihnacht_1';
    const orphan = ev({ id: 'o', source_name: 'q', title: 'Kinderweihnacht', start_date: '2026-10-07T18:30:00Z', last_seen_at: ORPHAN_SEEN, source_url: url, source_id: '16505' });
    const fresh = ev({ id: 'f', source_name: 'q', title: 'Kinderweihnacht', start_date: '2026-10-07T17:30:00Z', last_seen_at: SEEN, source_url: url });
    const other = ev({ id: 'x', source_name: 'q', title: 'Kinderweihnacht', start_date: '2026-10-07T13:00:00Z', last_seen_at: SEEN,
      source_url: 'https://www.pill.gv.at/k', location_name: 'Turnhalle', postal_code: '6136', latitude: 47.32, longitude: 11.68 });
    const r = dedupDay([orphan, fresh, other], { sourceLastSeen: lastSeen });
    expect(r.clusters).toEqual([expect.objectContaining({ primaryId: 'f', memberIds: expect.arrayContaining(['o', 'f']) })]);
  });

  it('Altzeile derselben Quelle mit genau +1 h am selben Ort wird verborgen (Zeitzonen-Altlast, nicht zwei Vorstellungen)', () => {
    const orphan = ev({ id: 'o', source_name: 'q', title: 'Adventeinklang am Maluhof', start_date: '2026-10-07T18:30:00Z', last_seen_at: ORPHAN_SEEN });
    const fresh = ev({ id: 'f', source_name: 'q', title: 'Adventeinklang am Maluhof', start_date: '2026-10-07T17:30:00Z', last_seen_at: SEEN });
    const r = dedupDay([orphan, fresh], { sourceLastSeen: lastSeen });
    expect(r.clusters).toEqual([expect.objectContaining({ primaryId: 'f' })]);
  });

  it('Freigabe in einen sichtbaren Zwilling hinein: stattdessen an ihn hängen', () => {
    // Primary verwaist an einem anderen Tag; am eigenen Tag steht dasselbe
    // Event schon sichtbar aus einer anderen Quelle (nur „uncertain").
    const stale = primary({ start_date: '2026-06-03T16:00:00Z', last_seen_at: ORPHAN_SEEN });
    const twin = ev({ id: 't', source_name: 'falter2', title: 'Spielenachmittag in der Bibliothek', last_seen_at: SEEN,
      location_name: 'Bücherei', postal_code: '3335', latitude: null, longitude: null, location_precision: null });
    const e = dup({ title: 'Spielenachmittag', location_name: 'Bibliothek Weyer', postal_code: '3335', latitude: null, longitude: null, location_precision: null });
    const p = planDedup([e, twin], dedupDay([e, twin], { sourceLastSeen: lastSeen }).clusters,
      { newClusterId: newId, sourceLastSeen: lastSeen, externalPrimaries: new Map([['b', stale]]) });
    expect(p.release).toEqual([]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'a', primaryId: 't', isNew: false })]);
  });

  // Stichprobe 2026-10-09 (Runde 2): 52 von 225 Freigaben ließen die sichtbare
  // Altzeile derselben Quelle am selben Tag stehen (Cäciliakonzert +1 h,
  // falscher Bezirk).
  it('verwaister sichtbarer Primary derselben Quelle: frische Zeile frei, Altzeile wird ihr Duplikat', () => {
    const p = planWith([
      ev({ id: 'a', source_name: 'q', title: 'Cäciliakonzert', start_date: '2026-10-07T14:00:00Z', last_seen_at: SEEN, district: 'salzburg-umgebung',
        publish_status: 'duplicate', duplicate_of: 'b' }),
      ev({ id: 'b', source_name: 'q', title: 'Cäciliakonzert', start_date: '2026-10-07T15:00:00Z', last_seen_at: ORPHAN_SEEN, district: 'zell am see' }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'b', primaryId: 'a' })]);
  });

  // Stichprobe 2026-10-09 (Runde 3)
  it('Altzeile bleibt sichtbar, wenn die frische Zeile selbst zurückgehalten bleibt (sonst ist das Event weg)', () => {
    const p = planWith([
      ev({ id: 'a', source_name: 'q', title: 'Eltern-Beratung', start_date: '2026-10-07T14:00:00Z', last_seen_at: SEEN, district: 'lienz',
        location_status: 'conflict', publish_status: 'duplicate', duplicate_of: 'b' }),
      ev({ id: 'b', source_name: 'q', title: 'Eltern-Beratung', start_date: '2026-10-07T15:00:00Z', last_seen_at: ORPHAN_SEEN, district: 'osttirol' }),
    ]);
    expect(p.markDuplicate.filter(m => m.id === 'b')).toEqual([]);
  });

  it('Altzeile derselben Detailseite mit leicht geändertem Titel wird Duplikat der frischen Zeile', () => {
    const url = 'https://www.steiermark.com/de/veranstaltungen/ed_81786888';
    const p = planWith([
      ev({ id: 'a', source_name: 'q', title: 'Herbstkonzert in Markt Hartmannsdorf', start_date: '2026-10-07T17:00:00Z', last_seen_at: SEEN,
        district: 'weiz', source_url: url, publish_status: 'duplicate', duplicate_of: 'b' }),
      ev({ id: 'b', source_name: 'q', title: 'Herbstwunschkonzert in Markt Hartmannsdorf', start_date: '2026-10-07T19:00:00Z',
        last_seen_at: ORPHAN_SEEN, district: 'hartberg', source_url: url }),
    ]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'b', primaryId: 'a' })]);
  });

  it('Altzeile derselben Detailseite an einem anderen Tag (alter Datumsfehler) wird Duplikat der frischen Zeile', () => {
    const url = 'https://www.ainet.at/system/web/veranstaltung.aspx?detailonr=226611735-2494';
    const stale = ev({ id: 'b', source_name: 'q', title: 'Advent im Dorf', start_date: '2026-10-08T16:00:00Z', last_seen_at: ORPHAN_SEEN, source_url: url });
    const p = planWith([ev({ id: 'a', source_name: 'q', title: 'Advent im Dorf', last_seen_at: SEEN, source_url: url,
      publish_status: 'duplicate', duplicate_of: 'b' })], new Map([['b', stale]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'b', primaryId: 'a' })]);
  });

  it('Etiketten-Widerspruch, aber dieselbe Detailseite derselben Quelle: kein Gegenbeleg (falsch konfigurierte Gemeinde)', () => {
    const url = 'https://www.gemeinde-buch.at/system/web/veranstaltung.aspx?detailonr=225448128-2551';
    const p = planWith([
      ev({ id: 'a', source_name: 'q', source_url: url, postal_code: '6220', latitude: null, longitude: null, location_precision: null,
        location_name: 'Dorfplatz', last_seen_at: SEEN, publish_status: 'duplicate', duplicate_of: 'b' }),
      ev({ id: 'b', source_name: 'q', source_url: url, postal_code: '6960', latitude: null, longitude: null, location_precision: null,
        location_name: 'Dorfplatz', last_seen_at: SEEN }),
    ]);
    expect(p.release).toEqual([]);
  });

  it('verwaister Primary an einem anderen Tag (schon vorbei): frische Zeile wird freigegeben', () => {
    const stale = primary({ start_date: '2026-10-06T16:30:00Z', last_seen_at: ORPHAN_SEEN });
    const p = planWith([dup({})], new Map([['b', stale]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_orphaned' })]);
  });

  it('verwaister Primary, Verbindung nicht bestätigt (anderer Titel): frische Zeile wird freigegeben', () => {
    const p = planWith([dup({ title: 'Ganz anderes Event' }), primary({ last_seen_at: ORPHAN_SEEN })]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a' })]);
  });

  // Prod 2026-10-08: „ABGESAGT: die große 70er Kult-Schlagershow" hing als
  // Duplikat unter der aktiven Zeile, die Seite zeigte das Event als
  // stattfindend.
  it.each([
    'ABGESAGT: Konzert X',
    'Konzert X - !!! ABGESAGT !!!',
    'Konzert X - ENTFÄLLT!',
    'Konzert X - verschoben auf 12.12.',
    'Konzert X fällt aus',
  ])('Absage-Variante wird nicht mit der aktiven Zeile verschmolzen: %s', (title) => {
    const p = planWith([dup({ title }), primary()]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'cancellation_marker' })]);
    expect(dedupDay([ev({ id: 'x', source_name: 'falter', title }), ev({ id: 'y', source_name: 'Eventim' })]).clusters).toEqual([]);
  });

  it('zwei Absage-Zeilen desselben Events verschmelzen weiter', () => {
    const r = dedupDay([ev({ id: 'x', source_name: 'falter', title: 'ABGESAGT: Konzert X' }), ev({ id: 'y', source_name: 'Eventim', title: 'Konzert X - abgesagt' })]);
    expect(r.clusters).toHaveLength(1);
  });

  it('dieselbe Seite derselben Quelle: die zuletzt gesehene Zeile ist die aktuelle und wird Primary', () => {
    const url = 'https://q.at/veranstaltung/1';
    const p = planWith([
      ev({ id: 'a', source_name: 'q', source_url: url, publish_status: 'duplicate', duplicate_of: 'b', last_seen_at: SEEN }),
      ev({ id: 'b', source_name: 'q', source_url: url, last_seen_at: '2026-09-29T03:00:00Z' }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_of_cluster' })]);
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'b', primaryId: 'a' })]);
  });

  // Abschlussprüfung 2026-10-08: Feratel führt Serien als Basiszeile ohne
  // Datum (wandert jede Nacht zum nächsten Termin) plus Terminzeilen mit
  // Datum in der Kennung. Gewann die Basiszeile, wechselte die sichtbare
  // Zeile samt URL kurz vor jedem Termin, und jede Nacht gab es hunderte
  // Umbauten.
  it('Serie: die Terminzeile mit Datum in der Kennung bleibt Primary, die wandernde Basiszeile hängt nur um', () => {
    const base = ev({ id: 'base', source_name: 'q', source_id: 'feratel-bccca177', quality_score: 90, last_seen_at: SEEN,
      start_date: '2026-10-14T17:00:00Z', publish_status: 'duplicate', duplicate_of: 'occ07' });
    const occ14 = ev({ id: 'occ14', source_name: 'q', source_id: 'feratel-bccca177:2026-10-14', quality_score: 60, last_seen_at: SEEN, start_date: '2026-10-14T17:00:00Z' });
    const occ07 = ev({ id: 'occ07', source_name: 'q', source_id: 'feratel-bccca177:2026-10-07', quality_score: 60, last_seen_at: SEEN, start_date: '2026-10-07T17:00:00Z' });
    const p = planWith([base, occ14], new Map([['occ07', occ07]]));
    expect(p.markDuplicate).toEqual([expect.objectContaining({ id: 'base', primaryId: 'occ14', isNew: false })]);
    expect(p.release).toEqual([]);
  });

  it('Primary unterdrückt (Müll-Titel „Event / Party"): aktuelle echte Zeile wird freigegeben', () => {
    const junk = primary({ title: 'Event\n            Party', publish_status: 'suppressed' });
    const p = planWith([dup({ title: 'Wickie, Slime und Paiper' }), junk]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary mit Ortskonflikt zurückgehalten: aktuelle Zeile wird freigegeben', () => {
    const held = primary({ title: 'Ganz anderer Titel', publish_status: 'needs_review', location_status: 'conflict' });
    const p = planWith([dup({}), held]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  // Abschlussprüfung 2026-10-08: „Brustkrebs Vortragsabend" wurde zurück-
  // gezogen (Quelle meldet ABSAGE), das 10 Tage alte Fremd-Duplikat wäre
  // danach als stattfindend wieder aufgetaucht.
  it('Primary zurückgezogen: ein Duplikat, das damals schon über 7 Tage nicht gesehen war, bleibt verborgen', () => {
    const withdrawn = primary({ publish_status: 'suppressed', withdrawn_at: '2026-10-07T04:00:00Z' } as Partial<EventRow>);
    const p = planWith([dup({ last_seen_at: '2026-09-28T03:00:00Z' })], new Map([['b', withdrawn]]));
    expect(p.release).toEqual([]);
  });

  it('Primary zurückgezogen, das Duplikat ist aktuell gelistet: freigeben', () => {
    const withdrawn = primary({ publish_status: 'suppressed', withdrawn_at: '2026-10-07T04:00:00Z' } as Partial<EventRow>);
    const p = planWith([dup({})], new Map([['b', withdrawn]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary verschwunden: aktuelle Zeile wird freigegeben', () => {
    const p = planWith([dup({ duplicate_of: 'weg' })]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_hidden' })]);
  });

  it('Primary unterdrückt, aber das Duplikat ist selbst Müll: bleibt verborgen', () => {
    const junk = primary({ title: 'Event\n            Party', publish_status: 'suppressed' });
    const p = planWith([dup({ title: 'Event\n            Jazz' }), junk]);
    expect(p.release).toEqual([]);
  });

  it('Primary an einem anderen Tag, beide aktuell: verschiedene Termine, freigeben', () => {
    const otherDay = primary({ start_date: '2026-10-14T17:30:00Z' });
    const p = planWith([dup({})], new Map([['b', otherDay]]));
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'different_day' })]);
  });

  it('Duplikat wird selbst Primary eines Clusters: freigeben', () => {
    const p = planWith([
      dup({ duplicate_of: 'weg', quality_score: 90 }),
      ev({ id: 'c', source_name: 'q', last_seen_at: SEEN }),
    ]);
    expect(p.release).toEqual([expect.objectContaining({ id: 'a', reason: 'primary_of_cluster' })]);
  });

  it('Primary bekommt fehlende Felder aus den Duplikaten', () => {
    const p = plan([
      ev({ id: 'a', source_name: 'wien-ticket', price_text: 'ab 28,70 EUR' }),
      ev({ id: 'b', source_name: 'Eventim', price_text: null }),
    ]);
    expect(p.primaries).toEqual([expect.objectContaining({ id: 'b', enrichments: expect.objectContaining({ price_text: 'ab 28,70 EUR' }) })]);
  });
});

describe('releaseStatus', () => {
  it('folgt dem gespeicherten Qualitätsscore', () => {
    expect(releaseStatus({ quality_score: 75 })).toBe('published');
    expect(releaseStatus({ quality_score: 45 })).toBe('published_low_confidence');
  });
  it('Quarantäne aus der Aufnahmeprüfung bleibt Quarantäne', () => {
    expect(releaseStatus({ quality_score: 90, admission_decision: 'quarantine' })).toBe('needs_review');
  });
  it('Ortskonflikt darf nicht veröffentlicht werden (DB-Constraint events_location_conflict_not_published)', () => {
    expect(releaseStatus({ quality_score: 90, location_status: 'conflict' })).toBe('needs_review');
  });
});

describe('dropDependentsOfFailedReleases', () => {
  it('hängt keine Duplikate an einen Primary, dessen Freigabe scheiterte (sonst ist das ganze Event unsichtbar)', () => {
    const p = {
      markDuplicate: [
        { id: 'a', primaryId: 'p', clusterId: 'c', score: 1, isNew: true },
        { id: 'b', primaryId: 'x', clusterId: 'd', score: 1, isNew: true },
      ],
      release: [{ id: 'p', previousPrimaryId: 'old', reason: 'primary_of_cluster' }],
      primaries: [{ id: 'p', clusterId: 'c', enrichments: {} }, { id: 'x', clusterId: 'd', enrichments: {} }],
    };
    const safe = dropDependentsOfFailedReleases(p, new Set(['p']));
    expect(safe.markDuplicate.map(m => m.id)).toEqual(['b']);
    expect(safe.primaries.map(m => m.id)).toEqual(['x']);
  });
});

describe('resolvePlanConflicts', () => {
  it('versteckt keine Zeile, die an ihrem eigenen Tag Primary oder freigegeben ist (tagesübergreifender Widerspruch)', () => {
    const p = {
      markDuplicate: [
        { id: 'p', primaryId: 'e', clusterId: 'c', score: 1, isNew: true },
        { id: 'x', primaryId: 'p', clusterId: 'd', score: 1, isNew: true },
        { id: 'r', primaryId: 'e', clusterId: 'c', score: 1, isNew: true },
      ],
      release: [{ id: 'r', previousPrimaryId: 'q', reason: 'primary_hidden' }],
      primaries: [{ id: 'e', clusterId: 'c', enrichments: {} }],
    };
    expect(resolvePlanConflicts(p).markDuplicate.map(m => m.id)).toEqual(['x']);
  });
});

describe('checkSafetyValve', () => {
  it('meldet Massenänderungen, statt sie still zu schreiben', () => {
    const p = { markDuplicate: Array.from({ length: 11 }, (_, i) => ({ id: `x${i}`, primaryId: 'p', clusterId: 'c', score: 1, isNew: true })), release: [{ id: 'r', previousPrimaryId: 'p', reason: 'different_title' }], primaries: [] };
    expect(checkSafetyValve(p, { maxNewDuplicates: 10, maxReleases: 5 })).toHaveLength(1);
    expect(checkSafetyValve(p, { maxNewDuplicates: 20, maxReleases: 0 })).toHaveLength(1);
    expect(checkSafetyValve(p, { maxNewDuplicates: 20, maxReleases: 5 })).toHaveLength(0);
  });

  it('Freigaben, die verborgen bleiben (Quarantäne, Ortskonflikt), zählen nicht', () => {
    const p = { markDuplicate: [], primaries: [], release: [
      { id: 'r1', previousPrimaryId: 'p', reason: 'different_title', visible: false },
      { id: 'r2', previousPrimaryId: 'p', reason: 'different_title', visible: true },
    ] };
    expect(checkSafetyValve(p, { maxNewDuplicates: 10, maxReleases: 1 })).toHaveLength(0);
  });

  it('zählt die Müll-Unterdrückung mit (Prod 2026-10-05: Ufo361 samt Eventim versteckt, ohne Grenze)', () => {
    const empty = { markDuplicate: [], release: [], primaries: [] };
    const limits = { maxNewDuplicates: 10, maxReleases: 5, maxGarbage: 100 };
    expect(checkSafetyValve(empty, limits, 101)).toEqual([expect.stringContaining('Müll')]);
    expect(checkSafetyValve(empty, limits, 100)).toHaveLength(0);
  });
});
