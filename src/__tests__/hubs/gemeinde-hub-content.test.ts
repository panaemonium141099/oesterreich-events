/**
 * fn-18 Task 4 — Mixed-Content-Modell der Gemeinde-Hub-Seite.
 *
 * Testet die puren Helper (src/lib/hubs/gemeinde-hub-content.ts) fuer die
 * 4 verbindlichen Content-Faelle: (a) event-only, (b) activity-only,
 * (c) mixed, (d) empty — inkl. der SEO-kritischen Invarianten:
 *   - Faelle (a)/(d) produzieren BYTE-IDENTISCHE Titles/Descriptions zur
 *     Vor-fn-18-Copy (kein SEO-Diff auf bereits indexierten Seiten),
 *   - activity-only emittiert kein event-bezogenes JSON-LD/FAQ und keine
 *     leere Event-ItemList,
 *   - das Indexierungs-Gate ist (Events >= 3 ODER Aktivitaeten >= 3).
 */

import { describe, it, expect } from 'vitest';
import {
  buildGemeindeHubJsonLd,
  buildHubFaqEntries,
  buildHubMeta,
  hubActivityHeroLead,
  hubContentMode,
  hubDefaultH1,
  hubExperimentAllowed,
  hubIsIndexable,
  hubMixedHeroLead,
  slugifyBundesland,
  type HubJsonLdActivity,
  type HubJsonLdEvent,
} from '@/lib/hubs/gemeinde-hub-content';
import type { AustrianGemeinde } from '@/lib/gemeinden/data';

const G: AustrianGemeinde = {
  name: 'Testdorf',
  plz: '7100',
  bezirk: 'Neusiedl am See',
  bundesland: 'Burgenland',
  lat: 47.95,
  lng: 16.85,
  slug: '7100-testdorf',
};

function makeEvents(n: number): HubJsonLdEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Event ${i}`,
    slug: `event-${i}`,
    start_date: '2026-09-01T19:00:00+00:00',
    postal_code: '7100',
    address: null,
    bundesland: 'burgenland',
    location_name: 'Testdorf Halle',
  }));
}

function makeActivities(n: number): HubJsonLdActivity[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `aktivitaet-${i}-abcdef123456`,
    name: `Aktivität ${i}`,
  }));
}

function parseGraph(jsonLd: string): Array<Record<string, unknown>> {
  return JSON.parse(jsonLd)['@graph'];
}

function findById(graph: Array<Record<string, unknown>>, idSuffix: string) {
  return graph.find((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith(idSuffix));
}

describe('hubContentMode + hubIsIndexable', () => {
  it('klassifiziert die 4 Faelle an der 3er-Schwelle', () => {
    expect(hubContentMode(3, 2)).toBe('events');
    expect(hubContentMode(2, 3)).toBe('activities');
    expect(hubContentMode(3, 3)).toBe('mixed');
    expect(hubContentMode(2, 2)).toBe('empty');
    expect(hubContentMode(0, 0)).toBe('empty');
  });

  it('Gate: indexierbar bei Events >= 3 ODER Aktivitaeten >= 3', () => {
    expect(hubIsIndexable(3, 0)).toBe(true);
    expect(hubIsIndexable(0, 3)).toBe(true); // NEU: activity-only ist indexierbar
    expect(hubIsIndexable(2, 2)).toBe(false);
    expect(hubIsIndexable(0, 0)).toBe(false);
  });

  it('Experiment-Overrides NUR im event-only-Fall (a) — nicht in b/c/d', () => {
    expect(hubExperimentAllowed(3, 0)).toBe(true); // (a)
    expect(hubExperimentAllowed(2, 3)).toBe(false); // (b)
    expect(hubExperimentAllowed(3, 3)).toBe(false); // (c)
    expect(hubExperimentAllowed(2, 2)).toBe(false); // (d) — auch empty nicht
    expect(hubExperimentAllowed(0, 0)).toBe(false); // (d)
  });
});

describe('buildHubMeta', () => {
  const base = {
    name: 'Testdorf',
    bezirk: 'Neusiedl am See' as string | null,
    plz: '7100',
    bundesland: 'Burgenland',
    isCityHub: false,
    year: 2026,
  };

  it('Fall (a) event-only: byte-identisch zur bisherigen Copy', () => {
    const { title, description } = buildHubMeta({ ...base, eventCount: 12, activityCount: 2 });
    expect(title).toBe('Events in Testdorf 7100 — 12 Veranstaltungen');
    expect(description).toBe(
      '12 Veranstaltungen in Testdorf (Neusiedl am See) — heute und in den kommenden Wochen. Konzerte, Feste, Kultur und mehr auf LassTreffen.at.',
    );
  });

  it('Fall (a) City-Hub: bisheriger Jahres-Title', () => {
    const { title } = buildHubMeta({ ...base, name: 'Linz', isCityHub: true, eventCount: 250, activityCount: 0 });
    expect(title).toBe('Veranstaltungen in Linz 2026 — 250 Events');
  });

  it('Fall (d) empty: bisherige Fallback-Copy inkl. Veranstaltungskalender-Title', () => {
    const { title, description } = buildHubMeta({ ...base, eventCount: 0, activityCount: 0 });
    expect(title).toBe('Events in Testdorf 7100 — Veranstaltungskalender');
    expect(description).toBe(
      'Veranstaltungen und Events in Testdorf (Neusiedl am See). Aktueller Veranstaltungskalender für Burgenland auf LassTreffen.at.',
    );
  });

  it('Fall (b) activity-only: Aktivitaets-Copy ohne Event-Empty-State', () => {
    const { title, description } = buildHubMeta({ ...base, eventCount: 0, activityCount: 17 });
    expect(title).toBe('Freizeitaktivitäten & Ausflugsziele in Testdorf');
    expect(description).toContain('17 Freizeitaktivitäten');
    expect(description).not.toContain('Veranstaltungskalender');
    expect(description).not.toContain('keine Events');
  });

  it('Fall (c) mixed: kombinierte Copy mit beiden Zahlen', () => {
    const { title, description } = buildHubMeta({ ...base, eventCount: 8, activityCount: 5 });
    expect(title).toBe('Events & Freizeitaktivitäten in Testdorf');
    expect(description).toContain('8 Veranstaltungen');
    expect(description).toContain('5 Freizeitaktivitäten');
  });
});

describe('hubDefaultH1 + hubActivityHeroLead', () => {
  it('H1 folgt den 4 Faellen; event-only/empty bleiben wie bisher', () => {
    const base = { name: 'Testdorf', isCityHub: false };
    expect(hubDefaultH1({ ...base, eventCount: 5, activityCount: 0 })).toBe('Events in Testdorf');
    expect(hubDefaultH1({ ...base, eventCount: 0, activityCount: 0 })).toBe('Events in Testdorf');
    expect(hubDefaultH1({ ...base, eventCount: 5, activityCount: 0, isCityHub: true })).toBe('Veranstaltungen in Testdorf');
    expect(hubDefaultH1({ ...base, eventCount: 0, activityCount: 4 })).toBe('Freizeitaktivitäten & Ausflugsziele in Testdorf');
    expect(hubDefaultH1({ ...base, eventCount: 4, activityCount: 4 })).toBe('Events & Freizeit in Testdorf');
  });

  it('Hero-Lead (Fall b) nennt die Zahl und keinen Event-Empty-State', () => {
    const lead = hubActivityHeroLead('Testdorf', 9);
    expect(lead).toContain('9 Freizeitaktivitäten');
    expect(lead).not.toContain('keine Events');
  });

  it('Hero-Lead (Fall c) kombiniert beide Zahlen', () => {
    const lead = hubMixedHeroLead('Testdorf', 7, 4);
    expect(lead).toContain('7 Veranstaltungen');
    expect(lead).toContain('4 dauerhafte Freizeitaktivitäten');
  });
});

describe('buildHubFaqEntries — FAQ folgt den 4 Faellen', () => {
  const input = { gemeinde: 'Testdorf', bundesland: 'Burgenland', plz: '7100' };

  it('event-only: bisheriges Event-FAQ', () => {
    const entries = buildHubFaqEntries({ ...input, eventCount: 5, activityCount: 0 });
    expect(entries[0].question).toBe('Welche Events gibt es heute in Testdorf?');
    expect(entries.some((e) => e.question.includes('Freizeitaktivitäten'))).toBe(false);
  });

  it('activity-only: KEIN event-bezogenes FAQ, >= 3 Aktivitaets-Eintraege', () => {
    const entries = buildHubFaqEntries({ ...input, eventCount: 0, activityCount: 6 });
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.some((e) => e.question.includes('Events gibt es heute'))).toBe(false);
    expect(entries[0].question).toContain('Freizeitaktivitäten');
  });

  it('mixed: Event-Set plus Aktivitaets-Kernfrage', () => {
    const entries = buildHubFaqEntries({ ...input, eventCount: 5, activityCount: 6 });
    expect(entries.some((e) => e.question.includes('Events gibt es heute'))).toBe(true);
    expect(entries.some((e) => e.question.includes('Freizeitaktivitäten'))).toBe(true);
  });

  it('empty: kein FAQ', () => {
    expect(buildHubFaqEntries({ ...input, eventCount: 2, activityCount: 2 })).toEqual([]);
  });
});

describe('buildGemeindeHubJsonLd — Mixed-Modell', () => {
  it('activity-only: keine Event-ItemList, kein Event-FAQ, Aktivitaeten-ItemList vorhanden', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, [], makeActivities(4)));

    expect(findById(graph, '#itemlist')).toBeUndefined();

    const activityList = findById(graph, '#activitylist');
    expect(activityList).toBeDefined();
    expect(activityList!.numberOfItems).toBe(4);
    const items = activityList!.itemListElement as Array<{ url: string; name: string }>;
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.url).toMatch(/^https:\/\/lasstreffen\.at\/aktivitaet\//);
    }

    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    expect(faq).toBeDefined();
    const questions = (faq!.mainEntity as Array<{ name: string }>).map((q) => q.name);
    expect(questions.some((q) => q.includes('Events gibt es heute'))).toBe(false);
    expect(questions[0]).toContain('Freizeitaktivitäten');
  });

  it('event-only: bisherige Struktur (Event-ItemList + Event-FAQ), keine Aktivitaeten-ItemList', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, makeEvents(5), []));

    const eventList = findById(graph, '#itemlist');
    expect(eventList).toBeDefined();
    expect(eventList!.numberOfItems).toBe(5);
    expect(findById(graph, '#activitylist')).toBeUndefined();

    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    expect(faq).toBeDefined();
    expect((faq!.mainEntity as Array<{ name: string }>)[0].name).toContain('Events gibt es heute');
  });

  it('mixed: beide ItemLists + kombiniertes FAQ', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, makeEvents(3), makeActivities(3)));
    expect(findById(graph, '#itemlist')).toBeDefined();
    expect(findById(graph, '#activitylist')).toBeDefined();
    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    const questions = (faq!.mainEntity as Array<{ name: string }>).map((q) => q.name);
    expect(questions.some((q) => q.includes('Events gibt es heute'))).toBe(true);
    expect(questions.some((q) => q.includes('Freizeitaktivitäten'))).toBe(true);
  });

  it('empty: nie eine leere ItemList, kein FAQ — Place + Breadcrumb bleiben', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, [], []));
    expect(graph.some((n) => n['@type'] === 'ItemList')).toBe(false);
    expect(graph.some((n) => n['@type'] === 'FAQPage')).toBe(false);
    expect(findById(graph, '#place')).toBeDefined();
    expect(findById(graph, '#breadcrumbs')).toBeDefined();
  });

  it('1-2 Events (< Schwelle, empty-Modus): Event-ItemList ja (nicht leer), FAQ nein', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, makeEvents(2), []));
    const eventList = findById(graph, '#itemlist');
    expect(eventList).toBeDefined();
    expect(eventList!.numberOfItems).toBe(2);
    expect(graph.some((n) => n['@type'] === 'FAQPage')).toBe(false);
  });

  it('activity-only MIT 1-2 Rest-Events: trotzdem KEINE Event-ItemList (Review-Finding)', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, makeEvents(2), makeActivities(4)));
    expect(findById(graph, '#itemlist')).toBeUndefined();
    expect(findById(graph, '#activitylist')).toBeDefined();
    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    expect(faq).toBeDefined();
    const questions = (faq!.mainEntity as Array<{ name: string }>).map((q) => q.name);
    expect(questions.some((q) => q.includes('Events gibt es heute'))).toBe(false);
  });

  it('2 Aktivitaeten (< Schwelle): keine Aktivitaeten-ItemList', () => {
    const graph = parseGraph(buildGemeindeHubJsonLd(G, makeEvents(5), makeActivities(2)));
    expect(findById(graph, '#activitylist')).toBeUndefined();
  });
});

describe('slugifyBundesland (aus der Page extrahiert, unveraendert)', () => {
  it('mappt alle 9 Bundeslaender', () => {
    expect(slugifyBundesland('Kärnten')).toBe('kaernten');
    expect(slugifyBundesland('Niederösterreich')).toBe('niederoesterreich');
    expect(slugifyBundesland('Wien')).toBe('wien');
  });
});
