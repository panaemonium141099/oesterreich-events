import { describe, it, expect } from 'vitest';
import {
  DORFFEST_POOL_EXCLUDE,
  DORFFEST_POOL_FILTER,
  DORFFEST_TAGS,
  DORFFESTE_HREF,
  FEST_CATEGORY,
  isDorffestEvent,
  isDorffestTitle,
} from '@/lib/landing/dorffeste';
import { PRIMARY_CATEGORIES, TAG_SET } from '@/lib/category-classifier/enrichment-taxonomy';

describe('Dorffeste der Landing', () => {
  it('nutzt nur Tags und die Kategorie aus der Taxonomie', () => {
    for (const tag of DORFFEST_TAGS) expect(TAG_SET.has(tag), tag).toBe(true);
    expect(PRIMARY_CATEGORIES as readonly string[]).toContain(FEST_CATEGORY);
  });

  it('starke Wörter reichen allein (Prod-Titel 2026-10-30)', () => {
    for (const title of [
      'Palfauer Kirtag', 'Obervellacher Kirchtag', 'Wolfgangibierzelt', 'Illmitzer Martiniloben-2026',
      'Feuerwehr Kirtagsheuriger', 'Kirtagsrummel im Festzelt', 'Dorffest Spannberg', 'Sturmfest',
      'Oktoberfest der FF Adnet', 'Maibaumaufstellen', 'Sonnwendfeier am Berg', 'Zeltfest Leonding',
      'Feuerwehrfest Ebenthal', 'FF-Fest Gols', 'FF Fest mit Frühschoppen', 'Maibaum umschneiden',
      'Maibaumkraxeln', 'Sonnwendfeuer', 'Johannisfeuer am Hügel', 'Erntedank in Perchtoldsdorf',
      'Weinlesefest Gamlitz', 'Mostkost Haag', 'Kellergassenfest Langenlois', 'Almabtrieb Alpbach',
      'Fetzenmarkt Schwarzenberg', 'Bezirksmusikfest', 'Martinikirtag in Markt St. Martin',
    ]) {
      expect(isDorffestEvent({ title }), title).toBe(true);
    }
  });

  it('schwache Wörter zählen nur als eingeordnetes Fest außerhalb des Ticket-Feeds', () => {
    const fest = { category: FEST_CATEGORY };
    expect(isDorffestEvent({ title: 'Genussmarkt & Frühschoppen', ...fest })).toBe(true);
    expect(isDorffestEvent({ title: 'Winterfest', ...fest })).toBe(true);
    expect(isDorffestEvent({ title: 'Festl am Dorfplatz', tags: ['dorffest'], category: 'Sonstiges' })).toBe(true);
    expect(isDorffestEvent({ title: 'Lichter Einschalt  Fest', tags: ['dorffest'] })).toBe(true);
    // Konzertformate, Vereinsfeste anderer Kategorien, Ticket-Feed
    expect(isDorffestEvent({ title: 'Monika Martin - Frühschoppen', category: 'Musik' })).toBe(false);
    expect(isDorffestEvent({ title: 'Björn von Morgenstern - Kreisverkehrfest', category: 'Kultur & Bühne' })).toBe(false);
    expect(isDorffestEvent({ title: 'Lesefest mit Mio Maus', category: 'Familie & Kinder' })).toBe(false);
    expect(isDorffestEvent({ title: 'Magic Pony Ranch Halloweenfest', category: 'Sonstiges', tags: [] })).toBe(false);
    expect(isDorffestEvent({ title: 'Töggelen-Frühschoppen', category: FEST_CATEGORY, source_name: 'Eventim' })).toBe(false);
    expect(isDorffestEvent({ title: 'Junkerfest Schloss Stainz', tags: ['weinfest'], source_name: 'Eventim' })).toBe(false);
  });

  it('nie ein Dorffest, auch mit Fest-Wort', () => {
    for (const title of [
      'Kunstprojekt Manifest der Leere', 'Hochfest Allerheiligen', 'Reformationsfest Gottesdienst',
      'Allerheiligen Festmesse', 'Festkonzert „Mit 66 Jahren“', 'Ausstellung „Münchner Oktoberfest“',
      'Diavortrag: Kirchliche Feste in Waizenkirchen', 'Purbacher Kellergassenführung',
      'Nova Rock Festival', 'Bregenzer Festspiele', 'Festakt 100 Jahre Gemeinde',
      'Sparefroh Weltspartag', 'Hendlwatten', 'Feuerwehrball', 'Feuerwehrübung', 'Ganslessen beim Hauslwirt',
      '', null,
    ]) {
      expect(isDorffestEvent({ title, category: FEST_CATEGORY, tags: ['dorffest'] }), String(title)).toBe(false);
      expect(isDorffestTitle(title), String(title)).toBe(false);
    }
  });

  it('PostgREST-Filter (Tags ODER Titel, ohne Festivals) und Listen-Link', () => {
    expect(DORFFEST_POOL_FILTER.startsWith('tags.ov.{dorffest,kirtag,')).toBe(true);
    expect(DORFFEST_POOL_FILTER).toContain('title.ilike.%kirtag%');
    expect(DORFFEST_POOL_FILTER).toContain('title.ilike.%fest%');
    expect(DORFFEST_POOL_FILTER).toContain('title.ilike.%maibaum%');
    expect(DORFFEST_POOL_EXCLUDE).toEqual(['%festival%', '%festspiel%']);
    expect(DORFFESTE_HREF).toBe('/entdecken?thema=dorffeste');
  });
});
