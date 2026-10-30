import { describe, it, expect } from 'vitest';
import { DORFFEST_TAGS, DORFFEST_TITLE_FILTER, DORFFESTE_HREF, isDorffestTitle } from '@/lib/landing/dorffeste';
import { TAG_SET } from '@/lib/category-classifier/enrichment-taxonomy';

describe('Dorffeste der Landing', () => {
  it('nutzt nur Tags aus der Taxonomie', () => {
    for (const tag of DORFFEST_TAGS) expect(TAG_SET.has(tag), tag).toBe(true);
  });

  it('erkennt Feste im Titel (Prod-Titel 2026-10-30)', () => {
    for (const title of [
      'Palfauer Kirtag', 'Obervellacher Kirchtag', 'Wolfgangibierzelt', 'Illmitzer Martiniloben-2026',
      'Feuerwehr Kirtagsheuriger', 'Kirtagsrummel im Festzelt', 'Dorffest Spannberg', 'Sturmfest',
      'Lichter Einschalt  Fest', 'Oktoberfest der FF Adnet', 'Festl am Dorfplatz', 'Frühschoppen der Musikkapelle',
      'Dämmerschoppen', 'Maibaumaufstellen', 'Sonnwendfeier am Berg', 'Zeltfest Leonding',
    ]) {
      expect(isDorffestTitle(title), title).toBe(true);
    }
  });

  it('lässt Tag-Treffer ohne Fest im Titel aus (Classifier streut)', () => {
    for (const title of [
      'Sparefroh Weltspartag', 'Veranstaltungskalender 2027 (Gemeinde)', 'Hendlwatten', 'Jungbauernball LJ/JB Mieders',
      'Nova Rock Festival', 'Bregenzer Festspiele', 'Festakt 100 Jahre Gemeinde', 'Adventmarkt Mittersill',
      'Einladung zum Dorf-Kaffeenachmittag', '', null,
    ]) {
      expect(isDorffestTitle(title), String(title)).toBe(false);
    }
  });

  it('PostgREST-Filter und Listen-Link', () => {
    expect(DORFFEST_TITLE_FILTER).toContain('title.ilike.%kirtag%');
    expect(DORFFEST_TITLE_FILTER).toContain('title.ilike.%fest%');
    expect(DORFFESTE_HREF).toBe('/entdecken?thema=dorffeste');
  });
});
