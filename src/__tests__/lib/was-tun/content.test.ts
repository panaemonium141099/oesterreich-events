/**
 * Inhalt der Seiten „Was kann man in X machen?": Titel, Antwort, FAQ und
 * strukturierte Daten kommen nur aus den geladenen Daten, Zahlen aus dem
 * gezählten Gesamtbestand.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAnswer,
  buildWasTunFaq,
  buildWasTunJsonLd,
  buildWasTunMeta,
  formatCount,
  scopeSentence,
  viennaDayMonth,
  wasTunIsIndexable,
  wasTunQuestion,
  type WasTunActivity,
  type WasTunEvent,
} from '@/lib/was-tun/content';
import { resolveWasTunPlace } from '@/lib/was-tun/places';

function ev(id: string, start: string, title = `Event ${id}`): WasTunEvent {
  return {
    id, title, slug: `event-${id}`, start_date: start, location_name: 'Saal', category: 'Musik',
    image_url: null, event_score: 50, postal_code: '7000', address: 'Hauptstraße 1, 7000 Eisenstadt',
    bundesland: 'burgenland',
  };
}

function act(id: string, name = `Ziel ${id}`): WasTunActivity {
  return { id, slug: `ziel-${id}`, name, tags: ['museum'], town: 'Eisenstadt', price_hint: null, images: null };
}

const eisenstadt = resolveWasTunPlace('7000-eisenstadt')!;
const salzkammergut = resolveWasTunPlace('salzkammergut')!;
const steiermark = resolveWasTunPlace('steiermark')!;

describe('Titel und Beschreibung', () => {
  it('die Frage trägt die Ortsangabe des Orts', () => {
    expect(wasTunQuestion(eisenstadt)).toBe('Was kann man in Eisenstadt machen?');
    expect(wasTunQuestion(salzkammergut)).toBe('Was kann man im Salzkammergut machen?');
    expect(wasTunQuestion(steiermark)).toBe('Was kann man in der Steiermark machen?');
  });

  it('Titel bleibt bei 60 Zeichen und verliert nie die Frage', () => {
    expect(buildWasTunMeta(eisenstadt, { events: 12, activities: 8 }).title)
      .toBe('Was kann man in Eisenstadt machen? Events & Ausflugsziele');
    const lang = resolveWasTunPlace('nationalpark-hohe-tauern-kaernten')!;
    expect(buildWasTunMeta(lang, { events: 12, activities: 8 }).title).toBe(wasTunQuestion(lang));
  });

  it('Beschreibung nennt den Gesamtbestand und nur, was es gibt', () => {
    expect(buildWasTunMeta(steiermark, { events: 9317, activities: 1928 }).description).toBe(
      'In der Steiermark: 9.317 Veranstaltungen und 1.928 Ausflugsziele und Freizeitaktivitäten auf einen Blick. ' +
      'Mit Terminen, Karte und Infos auf LassTreffen.at.',
    );
    expect(buildWasTunMeta(eisenstadt, { events: 12, activities: 0 }).description).toBe(
      'In Eisenstadt: 12 Veranstaltungen auf einen Blick. Mit Terminen, Karte und Infos auf LassTreffen.at.',
    );
    expect(buildWasTunMeta(eisenstadt, { events: 0, activities: 0 }).description).not.toMatch(/\d/);
  });

  it('Zahlen tragen den Tausenderpunkt', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(8542)).toBe('8.542');
    expect(formatCount(1234567)).toBe('1.234.567');
  });
});

describe('Antwort und FAQ', () => {
  const events = [ev('2', '2026-11-22T18:00:00Z', 'Adventmarkt'), ev('1', '2026-11-08T18:00:00Z', 'Martiniloben')];
  const activities = [act('a', 'Schloss Esterházy'), act('b', 'Haydn-Haus'), act('c', 'Bergkirche'), act('d', 'Landesmuseum')];
  const totals = { events: 509, activities: 71 };

  it('die Antwort nennt den Gesamtbestand, nicht die Länge der ersten Seite', () => {
    expect(buildAnswer(eisenstadt, totals, activities)).toBe(
      'In Eisenstadt findest du aktuell 509 Veranstaltungen und 71 Ausflugsziele und Freizeitaktivitäten. ' +
      'Zu den Ausflugszielen gehören Schloss Esterházy, Haydn-Haus und Bergkirche.',
    );
  });

  it('ohne Einträge behauptet die Antwort nichts', () => {
    const leer = { events: 0, activities: 0 };
    expect(buildAnswer(eisenstadt, leer, [])).toBe('In Eisenstadt sind aktuell keine Veranstaltungen und Ausflugsziele eingetragen.');
    expect(buildWasTunFaq(eisenstadt, leer, [], [])).toEqual([]);
  });

  it('die Terminfrage nennt die nächsten Termine in Wiener Zeit, der früheste zuerst', () => {
    const faq = buildWasTunFaq(eisenstadt, totals, events, activities);
    expect(faq.map((f) => f.question)).toEqual([
      'Was kann man in Eisenstadt machen?',
      'Welche Veranstaltungen gibt es demnächst in Eisenstadt?',
      'Welche Ausflugsziele gibt es in Eisenstadt?',
    ]);
    expect(faq[1].answer).toBe(
      'Die nächsten Termine: Martiniloben (8.11.) und Adventmarkt (22.11.). Alle weiteren Veranstaltungen stehen in der Liste auf dieser Seite.',
    );
  });

  it('Serien und doppelt gelieferte Ziele stehen nur einmal in den Antworten', () => {
    const serie = [
      ev('1', '2026-11-08T09:00:00Z', 'Adventkranzbinden'), ev('2', '2026-11-09T09:00:00Z', 'Adventkranzbinden'),
      ev('3', '2026-11-10T09:00:00Z', 'Kabarett'),
    ];
    const doppelt = [act('a', 'Almenwelt Lofer'), act('b', 'Almenwelt Lofer'), act('c', 'Minigolf')];
    const faq = buildWasTunFaq(eisenstadt, totals, serie, doppelt);
    expect(faq[1].answer).toContain('Adventkranzbinden (8.11.) und Kabarett (10.11.).');
    expect(faq[2].answer).toContain('gehören Almenwelt Lofer und Minigolf.');
    expect(buildAnswer(eisenstadt, totals, doppelt)).toContain('gehören Almenwelt Lofer und Minigolf.');
  });

  it('ein Termin kurz vor Mitternacht UTC zählt zum Wiener Folgetag', () => {
    expect(viennaDayMonth('2026-11-07T23:30:00Z')).toBe('8.11.');
  });

  it('ohne Events entfällt die Terminfrage, ohne Aktivitäten die Zielfrage', () => {
    expect(buildWasTunFaq(eisenstadt, { events: 0, activities: 4 }, [], activities).map((f) => f.question)).toEqual([
      'Was kann man in Eisenstadt machen?',
      'Welche Ausflugsziele gibt es in Eisenstadt?',
    ]);
    expect(buildWasTunFaq(eisenstadt, { events: 2, activities: 0 }, events, [])).toHaveLength(2);
  });

  it('keine Gedankenstriche in sichtbaren Texten', () => {
    const texts = [
      buildAnswer(eisenstadt, totals, activities),
      buildWasTunMeta(eisenstadt, totals).description,
      scopeSentence(eisenstadt)!, scopeSentence(salzkammergut)!,
      ...buildWasTunFaq(eisenstadt, totals, events, activities).flatMap((f) => [f.question, f.answer]),
    ];
    for (const t of texts) expect(t).not.toMatch(/[–—]| - /);
  });
});

describe('Gebiet der Seite', () => {
  it('Gemeinde und Region nennen ihren Umkreis, das Bundesland braucht keinen Satz', () => {
    expect(scopeSentence(eisenstadt)).toBe('Die Seite deckt den Umkreis von rund 10 km um Eisenstadt ab.');
    expect(scopeSentence(salzkammergut)).toBe('Die Seite deckt den Umkreis von rund 30 km um Bad Ischl ab.');
    expect(scopeSentence(steiermark)).toBeNull();
  });
});

describe('Index-Schwelle', () => {
  it('ab drei Einträgen zusammen indexierbar', () => {
    expect(wasTunIsIndexable({ events: 0, activities: 0 })).toBe(false);
    expect(wasTunIsIndexable({ events: 1, activities: 1 })).toBe(false);
    expect(wasTunIsIndexable({ events: 2, activities: 1 })).toBe(true);
    expect(wasTunIsIndexable({ events: 0, activities: 3 })).toBe(true);
  });
});

describe('JSON-LD', () => {
  const events = [ev('1', '2026-11-08T18:00:00Z', 'Martiniloben')];
  const activities = [act('a', 'Schloss Esterházy'), act('b', 'Haydn-Haus')];
  const totals = { events: 509, activities: 71 };

  it('Brotkrumen, je Art eine Liste mit dem Gesamtbestand, FAQ ab drei Fragen', () => {
    const graph = JSON.parse(buildWasTunJsonLd(eisenstadt, totals, events, activities))['@graph'];
    expect(graph.map((n: { '@type': string }) => n['@type'])).toEqual(['BreadcrumbList', 'ItemList', 'ItemList', 'FAQPage']);
    expect(graph[0].itemListElement.map((c: { name: string }) => c.name)).toEqual(['Home', 'Was tun', 'Burgenland', 'Eisenstadt']);
    expect(graph[1].numberOfItems).toBe(509);
    expect(graph[1].itemListElement[0].url).toMatch(/\/events\//);
    expect(graph[2].numberOfItems).toBe(71);
    expect(graph[2].itemListElement.map((l: { url: string }) => l.url.split('/').pop())).toEqual(['ziel-a', 'ziel-b']);
  });

  it('ohne Einträge nur Brotkrumen, beim Bundesland ohne Zwischenebene', () => {
    const graph = JSON.parse(buildWasTunJsonLd(steiermark, { events: 0, activities: 0 }, [], []))['@graph'];
    expect(graph).toHaveLength(1);
    expect(graph[0].itemListElement.map((c: { name: string }) => c.name)).toEqual(['Home', 'Was tun', 'Steiermark']);
  });

  it('ein Titel kann das Script-Tag nicht schließen', () => {
    const json = buildWasTunJsonLd(eisenstadt, totals, [ev('1', '2026-11-08T18:00:00Z', 'x</script><b>')], []);
    expect(json).not.toContain('</script>');
  });
});
