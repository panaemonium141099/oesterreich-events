import { describe, it, expect } from 'vitest';
import {
  topicWindow, matchesTopic, pickSeasonEvents, needsRefresh, deniesProgramme,
  MIN_PROGRAMME_EVENTS, REFRESH_MIN_INTERVAL_DAYS,
  type SaisonEvent,
} from '@/lib/blog/saison-events';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

const ev = (title: string, bundesland: string | null, score = 60, start = '2026-12-31'): SaisonEvent => ({
  title, start_date: `${start}T19:00:00+00:00`, location_name: null, bundesland,
  price_text: null, source_url: null, event_score: score,
});

describe('topicWindow', () => {
  const silvester = { from: '12-30', to: '01-02' };

  it('legt ein Fenster über den Jahreswechsel ins laufende Jahr, wenn es noch bevorsteht', () => {
    expect(topicWindow(silvester, at('2026-11-03'))).toEqual({ from: '2026-12-30', to: '2027-01-02' });
  });

  it('bleibt am 1. Jänner bei der laufenden Ausgabe statt elf Monate vorauszuspringen', () => {
    expect(topicWindow(silvester, at('2027-01-01'))).toEqual({ from: '2026-12-30', to: '2027-01-02' });
  });

  it('springt nach dem Fensterende auf die nächste Ausgabe', () => {
    expect(topicWindow(silvester, at('2027-01-03'))).toEqual({ from: '2027-12-30', to: '2028-01-02' });
  });

  it('behandelt ein Fenster innerhalb eines Jahres', () => {
    expect(topicWindow({ from: '10-15', to: '11-01' }, at('2026-09-20'))).toEqual({ from: '2026-10-15', to: '2026-11-01' });
    expect(topicWindow({ from: '10-15', to: '11-01' }, at('2026-11-02'))).toEqual({ from: '2027-10-15', to: '2027-11-01' });
  });
});

describe('matchesTopic', () => {
  it('findet Suchwörter unabhängig von Groß- und Kleinschreibung', () => {
    expect(matchesTopic('Omar Sarsam - Silvester Special', { keywords: ['silvester'] })).toBe(true);
    expect(matchesTopic('NEUJAHRSKONZERT 2027', { keywords: ['silvester', 'neujahr'] })).toBe(true);
  });

  it('lässt Ausschlusswörter gewinnen', () => {
    const topic = { keywords: ['ball'], excludeKeywords: ['fußball', 'handball'] };
    expect(matchesTopic('Fußball: Austria gegen Rapid', topic)).toBe(false);
    expect(matchesTopic('Juristenball 2027', topic)).toBe(true);
  });
});

describe('pickSeasonEvents', () => {
  const topic = Array.from({ length: 30 }, (_, i) => ev(`Silvester ${i}`, ['wien', 'tirol', 'salzburg'][i % 3], 60));
  const november = Array.from({ length: 50 }, (_, i) => ev(`Konzert ${i}`, 'wien', 75, '2026-11-10'));

  it('nimmt nur Thementreffer, wenn das Programm bekannt ist, auch wenn Kategorie-Events höher scoren', () => {
    const pick = pickSeasonEvents(topic, november);
    expect(pick.programmeKnown).toBe(true);
    expect(pick.topicCount).toBe(30);
    expect(pick.events.every((e) => e.title.startsWith('Silvester'))).toBe(true);
  });

  it('streut Thementreffer je Bundesland und füllt danach mit weiteren Thementreffern auf', () => {
    const pick = pickSeasonEvents(topic, november, { perBundesland: 2, max: 10 });
    expect(pick.events).toHaveLength(10);
    const first6 = pick.events.slice(0, 6).map((e) => e.bundesland);
    expect(new Set(first6).size).toBe(3);
  });

  it('füllt mit Kategorie-Events auf, wenn das Thema zu wenig hergibt, und bleibt ehrlich über das Programm', () => {
    const few = topic.slice(0, 3);
    const pick = pickSeasonEvents(few, november, { max: 12 });
    expect(pick.programmeKnown).toBe(true);
    expect(pick.events.slice(0, 3)).toEqual(few);
    expect(pick.events).toHaveLength(8); // 3 Thema + 5 (perBundesland) aus Wien
  });

  it('meldet ohne Thementreffer, dass kein Programm bekannt ist', () => {
    const pick = pickSeasonEvents([], november);
    expect(pick.programmeKnown).toBe(false);
    expect(pick.topicCount).toBe(0);
    expect(pick.events.length).toBeGreaterThan(0);
  });

  it('nimmt reihum je Bundesland, damit kein Bundesland wegfällt, wenn andere die Auswahl füllen könnten', () => {
    const nine = ['wien', 'niederoesterreich', 'oberoesterreich', 'salzburg', 'tirol', 'vorarlberg', 'kaernten', 'steiermark', 'burgenland'];
    const many = nine.flatMap((bl, i) => Array.from({ length: 8 }, (_, j) => ev(`Silvester ${bl} ${j}`, bl, 60 + (9 - i))));
    const pick = pickSeasonEvents(many, [], { perBundesland: 5, max: 36 });
    expect(pick.events).toHaveLength(36);
    expect(new Set(pick.events.map((e) => e.bundesland)).size).toBe(9);
  });

  it('lässt Doppelzeilen (gleicher Titel am gleichen Tag) nur einmal durch', () => {
    const twice = [ev('Silvester mit Stefan Haider', 'niederoesterreich'), ev('Silvester mit Stefan Haider', 'niederoesterreich'), ...topic];
    const pick = pickSeasonEvents(twice, []);
    expect(pick.events.filter((e) => e.title === 'Silvester mit Stefan Haider')).toHaveLength(1);
  });

  it('zählt denselben Termin nicht doppelt, wenn er in beiden Listen steht', () => {
    const shared = ev('Silvester im Dorf', 'kaernten');
    const pick = pickSeasonEvents([shared], [shared, ...november], { max: 12 });
    expect(pick.events.filter((e) => e.title === 'Silvester im Dorf')).toHaveLength(1);
  });
});

describe('deniesProgramme', () => {
  it('findet die Sätze des Silvester-Guides vom 03.11.2026 (Bezug auf unser Wissen)', () => {
    expect(deniesProgramme({
      intro: 'Dieser Guide hilft dir. Die konkreten Silvesterprogramme für 2026/27 sind in unserer Datenbank noch nicht angekündigt.',
    })).toMatch(/noch nicht angekündigt/);
    expect(deniesProgramme({
      faqs: [{ answer: 'Konkrete Silvesterevents für 2026 sind bei uns noch nicht angekündigt.' }],
    })).toBeTruthy();
    expect(deniesProgramme({ keyFacts: { dates: 'Silvesternacht; konkrete Programme für 2026/27 sind in unserer Datenbank noch nicht angekündigt' } })).toBeTruthy();
    expect(deniesProgramme({ whatToExpect: 'Für alle vier gilt: Die Details für Silvester 2026 sind bei uns noch nicht angekündigt.' })).toBeTruthy();
  });

  it('lässt belegte Aussagen über einzelne Veranstaltungen durch (daran scheiterten die Läufe am 04.11.2026)', () => {
    expect(deniesProgramme({ whatToExpect: 'Der Silvesterpfad läuft wieder in der Innenstadt. Das detaillierte Bühnenprogramm für heuer ist noch nicht veröffentlicht.' })).toBeUndefined();
    expect(deniesProgramme({ whatToExpectList: ['**Salzburg.** Die Altstadt feiert jedes Jahr rund um Dom und Kapitelplatz; das offizielle Gesamtprogramm 2026 ist laut Recherche noch nicht veröffentlicht.'] })).toBeUndefined();
    expect(deniesProgramme({ faqs: [{ answer: 'Termine, Bühnenprogramm und Uhrzeiten des Silvesterpfads für 2026 sind noch nicht angekündigt.' }] })).toBeUndefined();
  });

  it('lässt ehrliche Preisaussagen durch', () => {
    expect(deniesProgramme({ keyFacts: { price: 'Je nach Veranstaltung; Preise sind bei uns für Silvester 2026 noch nicht bekannt' } })).toBeUndefined();
  });

  it('meldet nichts bei einem Guide, der über das Programm schreibt', () => {
    expect(deniesProgramme({ intro: 'Am Silvesterpfad spielt um Mitternacht der Donauwalzer. Im Konzerthaus tritt Omar Sarsam auf.' })).toBeUndefined();
  });
});

describe('needsRefresh', () => {
  const today = at('2026-12-01');

  it('zieht nicht nach, solange das Programm nicht bekannt ist', () => {
    expect(needsRefresh(undefined, MIN_PROGRAMME_EVENTS - 1, today)).toBe(false);
  });

  it('zieht einen Guide ohne gespeicherten Stand nach, sobald Programm da ist', () => {
    expect(needsRefresh(undefined, MIN_PROGRAMME_EVENTS, today)).toBe(true);
  });

  it('zieht nach, wenn beim letzten Stand kein Programm bekannt war', () => {
    expect(needsRefresh({ topicCount: 0, writtenAt: '2026-11-03' }, 300, today)).toBe(true);
  });

  it('wartet die Mindestfrist seit dem letzten Schreiben ab', () => {
    const recent = new Date(today.getTime() - (REFRESH_MIN_INTERVAL_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    expect(needsRefresh({ topicCount: 0, writtenAt: recent }, 300, today)).toBe(false);
  });

  it('zieht bei bekanntem Programm erst nach deutlichem Wachstum nach', () => {
    expect(needsRefresh({ topicCount: 100, writtenAt: '2026-11-01' }, 120, today)).toBe(false);
    expect(needsRefresh({ topicCount: 100, writtenAt: '2026-11-01' }, 150, today)).toBe(true);
  });
});
