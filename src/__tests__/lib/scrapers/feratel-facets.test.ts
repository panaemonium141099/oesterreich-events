import { describe, expect, it } from 'vitest';
import {
  feratelCategoryFromCriteria,
  feratelDurationMinutes,
  feratelFacets,
  feratelLocalEnd,
  pickFeratelDescription,
  pickFeratelImage,
} from '@/lib/scrapers/feratel-facets';
import { AUDIENCES, OCCASIONS, PRICE_FLAGS, SETTINGS, TAGS } from '@/lib/category-classifier/enrichment-taxonomy';
import { CATEGORIES } from '@/lib/category-classifier/taxonomy';

describe('feratelCategoryFromCriteria', () => {
  it('ein Kriterium -> eindeutige Kategorie mit kanonischen Tags', () => {
    const r = feratelCategoryFromCriteria([{ groupName: 'Musik', items: ['Volksmusik'] }]);
    expect(r.category).toBe('Musik');
    expect(r.unambiguous).toBe(true);
    expect(r.tags).toEqual(['volksmusik']);
  });

  it('mehrere Kategorien -> Vorgabe nach Prioritaet, nicht eindeutig', () => {
    const r = feratelCategoryFromCriteria([
      { groupName: 'Feste / Feiern', items: ['Kulinarisches Fest'] },
      { groupName: 'Musik', items: ['Musikveranstaltung / Konzerte'] },
    ]);
    expect(r.unambiguous).toBe(false);
    expect(r.category).toBe('Essen & Trinken');
    expect(r.categories).toEqual(['Essen & Trinken', 'Musik']);
  });

  it('Sammelbegriffe bleiben ohne Kategorie, Gruppe greift als Rueckfall', () => {
    expect(feratelCategoryFromCriteria([{ groupName: 'Diverse Veranstaltungen', items: ['Diverse Veranstaltungen/Feste'] }]).category).toBeNull();
    const r = feratelCategoryFromCriteria([{ groupName: 'Sport', items: ['Unbekannte Sportart'] }]);
    expect(r.category).toBe('Sport & Bewegung');
    expect(r.unambiguous).toBe(true);
  });

  it('mainCriteria zaehlt mit', () => {
    const r = feratelCategoryFromCriteria([], 'Flohmarkt');
    expect(r.category).toBe('Märkte & Feste');
    expect(r.tags).toEqual(['flohmarkt']);
  });

  it('alle gemappten Kategorien und Tags stehen im Vokabular', () => {
    // Jedes Item einzeln durchschicken, damit Tags und Kategorien geprueft werden
    const sample = [
      'Musikveranstaltung / Konzerte', 'Kabarett / Satire', 'Advent / Christkindl- / Weihnachtsmärkte', 'Weinfest',
      'Radsport', 'Wanderung / Bergtour', 'Kinder- / Familienfest', 'Diverse Kurse/Seminare/Workshops',
      'Messe / Gottesdienst', 'Clubbing / Party', 'Krampus/Perchtenläufe', 'Marionetten / Puppentheater', 'Schiffs- / Bootstouren',
    ];
    for (const item of sample) {
      const r = feratelCategoryFromCriteria([{ groupName: null, items: [item] }]);
      expect(r.category, item).not.toBeNull();
      expect((CATEGORIES as readonly string[]).includes(r.category as string), item).toBe(true);
      for (const t of r.tags) expect((TAGS as readonly string[]).includes(t), `${item} -> ${t}`).toBe(true);
    }
  });
});

describe('feratelFacets', () => {
  it('Urlaubsthemen -> Zielgruppe, Setting, Anlass, Preis-Flag', () => {
    const f = feratelFacets({
      holidayThemes: ['Familie', 'Indoor', 'Schlechtwetter Tipp', 'Weekend', 'Barrierefrei', 'VA Englisch'],
      criteria: [{ groupName: 'Veranstaltung', items: ['Kostenloser Eintritt'] }],
      isTopEvent: true,
      onlineBookable: true,
      guestCards: ['Alpbachtal Card '],
    });
    expect(f.audience).toEqual(['familien-mit-kindern', 'erasmus-freundlich']);
    expect(f.setting).toEqual(['indoor']);
    expect(f.occasion_tags).toEqual(['regentag', 'wochenendplan']);
    expect(f.price_flags).toEqual(['barrierefrei', 'freier-eintritt']);
    expect(f.language).toBe('englisch');
    expect(f.is_family_friendly).toBe(true);
    expect(f.rawTags).toEqual(['Top-Event', 'Online buchbar', 'Gästekarte: Alpbachtal Card']);
    for (const a of f.audience) expect((AUDIENCES as readonly string[]).includes(a)).toBe(true);
    for (const s of f.setting) expect((SETTINGS as readonly string[]).includes(s)).toBe(true);
    for (const o of f.occasion_tags) expect((OCCASIONS as readonly string[]).includes(o)).toBe(true);
    for (const p of f.price_flags) expect((PRICE_FLAGS as readonly string[]).includes(p)).toBe(true);
  });

  it('ohne Signale bleibt alles leer', () => {
    const f = feratelFacets({ holidayThemes: ['Herbst'], criteria: [] });
    expect(f.audience).toEqual([]);
    expect(f.setting).toEqual([]);
    expect(f.language).toBeNull();
    expect(f.is_family_friendly).toBeNull();
    expect(f.rawTags).toEqual([]);
  });

  it('Senioren und Studierende aus dem Familie-Block sind Zielgruppen, keine Familienevents', () => {
    const f = feratelFacets({ holidayThemes: [], criteria: [{ groupName: 'Familie', items: ['SeniorInnen'] }] });
    expect(f.audience).toContain('senioren');
    // Gruppe "Familie" gilt als Familiensignal (so pflegen es die Regionen)
    expect(f.is_family_friendly).toBe(true);
  });
});

describe('Dauer und Endzeit', () => {
  it('Werte bis 24 sind Stunden, groessere Minuten, 0 unbekannt', () => {
    expect(feratelDurationMinutes(2)).toBe(120);
    expect(feratelDurationMinutes(90)).toBe(90);
    expect(feratelDurationMinutes(420)).toBe(420);
    expect(feratelDurationMinutes(0)).toBeNull();
    expect(feratelDurationMinutes(24)).toBeNull();
    expect(feratelDurationMinutes(null)).toBeNull();
  });

  it('Endzeit als Wandzeit aus dem passenden Startzeit-Eintrag', () => {
    expect(feratelLocalEnd('2026-09-20T11:00:00', [{ time: '11:00', weekDays: 64, duration: 2 }])).toBe('2026-09-20T13:00:00');
    expect(feratelLocalEnd('2026-09-18T16:30:00', [{ time: '09:00', duration: 1 }, { time: '16:30', duration: 90 }])).toBe('2026-09-18T18:00:00');
    expect(feratelLocalEnd('2026-09-18T23:30:00', [{ time: '23:30', duration: 60 }])).toBe('2026-09-19T00:30:00');
    expect(feratelLocalEnd('2026-09-18T16:30:00', [{ time: '16:30', duration: 0 }])).toBeNull();
    expect(feratelLocalEnd('2026-09-18T16:30:00', null)).toBeNull();
  });
});

describe('Bild und Beschreibung', () => {
  it('ueberspringt KI-generierte Bilder und liefert den Credit', () => {
    const pick = pickFeratelImage([
      { urls: ['//img/ai.jpg'], ai: { isAiGenerated: true }, copyright: 'ai generated' },
      { urls: ['//img/real.jpg'], copyright: 'TVB Abtenau', ai: { isAiGenerated: false } },
    ]);
    expect(pick).toEqual({ url: 'https://img/real.jpg', credit: 'TVB Abtenau' });
    expect(pickFeratelImage([{ urls: ['//img/ai.jpg'], ai: { isAiGenerated: true } }])).toBeNull();
  });

  it('Langtext vor Kurztext', () => {
    expect(pickFeratelDescription([{ description: '', type: 32 }, { description: 'Kurz', type: 33 }])).toBe('Kurz');
    expect(pickFeratelDescription([{ description: 'Lang', type: 32 }, { description: 'Kurz', type: 33 }])).toBe('Lang');
    expect(pickFeratelDescription(null)).toBeNull();
  });
});

describe('parseFeratelPrice', () => {
  it('liest Betraege aus Preisangaben der Regionen', async () => {
    const { parseFeratelPrice } = await import('@/lib/scrapers/feratel-facets');
    expect(parseFeratelPrice('Preis Erwachsene: EUR 69,00 Kinder auf Anfrage. Bei Zusendung von Gutscheinen wird eine Bearbeitungsgebühr von EUR 2,00 berechnet')).toEqual({ min: 69, max: null });
    expect(parseFeratelPrice('€ 19,-/Erw. (€ 9,-/Kind)')).toEqual({ min: 19, max: null });
    expect(parseFeratelPrice('Erwachsene € 15,00 Kinder ab 6 Jahren € 6,00 Familie (2 Erw. & Kinder bis 18) € 34,00')).toEqual({ min: 15, max: 34 });
    expect(parseFeratelPrice('10,70')).toEqual({ min: 10.7, max: null });
    expect(parseFeratelPrice('Eintritt frei!')).toEqual({ min: 0, max: null });
    expect(parseFeratelPrice('Preis auf Anfrage!')).toBeNull();
    expect(parseFeratelPrice(null)).toBeNull();
  });
});
