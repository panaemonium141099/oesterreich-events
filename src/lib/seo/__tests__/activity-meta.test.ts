import { describe, it, expect } from 'vitest';
import {
  buildActivityTitle,
  buildActivityDescription,
  firstUsefulSentence,
  activityTypeLabel,
} from '../activity-meta';
import { messageTranslator } from '@/test/i18n';

/**
 * fn-17: die Textbausteine liegen jetzt in messages/<locale>.json. Die
 * byte-identischen DE-Assertions unten pruefen damit zusaetzlich, dass
 * der Katalog dieselben Strings liefert wie der frueher hier eingebaute
 * Code.
 */
const tMeta = messageTranslator('de', 'ActivityMeta');
const tMetaEn = messageTranslator('en', 'ActivityMeta');

describe('firstUsefulSentence', () => {
  it('überspringt Begrüßungsfloskeln (der eigentliche CTR-Killer)', () => {
    expect(firstUsefulSentence('Willkommen im Seeschloss Ort!')).toBe(null);
    expect(firstUsefulSentence('Tauche ein in das Abenteuer')).toBe(null);
    expect(
      firstUsefulSentence('Herzlich willkommen! Das Schloss steht seit 1080 auf einer Insel im Traunsee.'),
    ).toBe('Das Schloss steht seit 1080 auf einer Insel im Traunsee.');
  });

  it('nimmt informative Sätze unverändert', () => {
    expect(firstUsefulSentence('Gemütliche Klammwanderung für die ganze Familie entlang des Gamsbaches.'))
      .toBe('Gemütliche Klammwanderung für die ganze Familie entlang des Gamsbaches.');
  });

  it('verwirft zu kurze Fragmente und leere Eingaben', () => {
    expect(firstUsefulSentence('Sehr schön.')).toBe(null);
    expect(firstUsefulSentence(null)).toBe(null);
    expect(firstUsefulSentence('')).toBe(null);
  });
});

describe('buildActivityTitle', () => {
  it('nutzt den Platz bis 60 Zeichen mit Nutzen-Suffix', () => {
    const t = buildActivityTitle({ name: 'Seeschloss Ort', town: 'Gmunden', openingTimes: { mo: '9-17' } }, tMeta);
    expect(t).toBe('Seeschloss Ort in Gmunden — Öffnungszeiten & Anfahrt');
    expect(t.length).toBeLessThanOrEqual(60);
  });

  it('fällt ohne Öffnungszeiten auf ein kürzeres Suffix zurück', () => {
    expect(buildActivityTitle({ name: 'Nothklamm', town: 'Landl' }, tMeta))
      .toBe('Nothklamm in Landl — Infos & Anfahrt');
  });

  it('lässt Suffixe weg, wenn der Name schon lang ist', () => {
    const t = buildActivityTitle({
      name: 'Museum HochQuellenWasser mit Sonderausstellung',
      town: 'Wildalpen',
    }, tMeta);
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.startsWith('Museum HochQuellenWasser')).toBe(true);
  });

  it('nimmt das Bundesland, wenn kein Ort bekannt ist', () => {
    expect(buildActivityTitle({ name: 'Wanderweg', bundeslandName: 'Tirol' }, tMeta))
      .toContain('Wanderweg in Tirol');
  });
});

describe('buildActivityDescription', () => {
  it('ersetzt die Floskel durch Ort + Typ + Hinweis', () => {
    const d = buildActivityDescription({
      name: 'Seeschloss Ort',
      town: 'Gmunden',
      bundeslandName: 'Oberösterreich',
      tags: ['burgführung'],
      description: 'Willkommen im Seeschloss Ort!',
      openingTimes: { mo: '9-17' },
    }, tMeta);
    expect(d).toContain('Seeschloss Ort in Gmunden, Oberösterreich');
    expect(d).not.toContain('Willkommen');
    expect(d.length).toBeLessThanOrEqual(158);
  });

  it('behält einen informativen Quellsatz bei', () => {
    const d = buildActivityDescription({
      name: 'Nothklamm',
      town: 'Landl',
      tags: ['naturführung'],
      descriptionShort: 'Gemütliche Klammwanderung für die ganze Familie entlang des Gamsbaches.',
    }, tMeta);
    expect(d).toContain('Klammwanderung');
    expect(d.length).toBeLessThanOrEqual(158);
  });

  it('setzt den Preis als eigenen Satz', () => {
    const d = buildActivityDescription({
      name: 'Seeschloss Ort', town: 'Gmunden', tags: ['burgführung'],
      priceHint: 'ab € 3', openingTimes: { mo: '9-17' },
    }, tMeta);
    expect(d).toContain('ab € 3.');
    expect(d).not.toContain('ab € 3 Öffnungszeiten');
  });

  it('kommt ohne Tags und ohne Text aus', () => {
    const d = buildActivityDescription({ name: 'escape house Vorchdorf', town: 'Vorchdorf im Almtal' }, tMeta);
    expect(d).toContain('escape house Vorchdorf in Vorchdorf im Almtal');
    expect(d.length).toBeGreaterThan(40);
  });

  it('haelt die Laenge auch bei sehr langen Quelltexten ein', () => {
    const d = buildActivityDescription({
      name: 'Forstmuseum Silvanum',
      town: 'Landl',
      tags: ['museumstour'],
      description: 'In Großreifling steht das Silvanum. '.repeat(20),
    }, tMeta);
    expect(d.length).toBeLessThanOrEqual(158);
  });
});

describe('activityTypeLabel', () => {
  it('nimmt das erste Tag, sonst null', () => {
    expect(activityTypeLabel(['museumstour', 'ausstellung'])).toBeTruthy();
    expect(activityTypeLabel([])).toBe(null);
    expect(activityTypeLabel(null)).toBe(null);
  });
});

describe('EN-Fassung (fn-17)', () => {
  it('Title nutzt die englischen Suffixe', () => {
    expect(
      buildActivityTitle({ name: 'Seeschloss Ort', town: 'Gmunden', openingTimes: { mo: '9-17' } }, tMetaEn),
    ).toBe('Seeschloss Ort in Gmunden — opening hours & directions');
  });

  it('Description zitiert NUR aus descriptionEn, nie aus dem deutschen Text', () => {
    const input = {
      name: 'Nothklamm',
      town: 'Landl',
      bundeslandName: 'Steiermark',
      description: 'Gemütliche Klammwanderung für die ganze Familie entlang des Gamsbaches.',
      descriptionEn: 'A relaxed gorge hike for the whole family along the Gamsbach stream.',
    };
    const en = buildActivityDescription(input, tMetaEn, 'en');
    expect(en).toContain('A relaxed gorge hike');
    expect(en).not.toContain('Klammwanderung');
    expect(en).toContain('Map, directions and events nearby.');
  });

  it('ohne descriptionEn bleibt die Description bei den strukturierten Feldern', () => {
    const en = buildActivityDescription(
      {
        name: 'Nothklamm',
        town: 'Landl',
        description: 'Gemütliche Klammwanderung für die ganze Familie entlang des Gamsbaches.',
      },
      tMetaEn,
      'en',
    );
    // Kein deutscher Satz im englischen Snippet — das war der Punkt.
    expect(en).not.toContain('Klammwanderung');
    expect(en).toContain('Nothklamm in Landl');
  });

  it('ohne Ort steht "Austria" statt "Österreich"', () => {
    expect(buildActivityDescription({ name: 'Testziel' }, tMetaEn, 'en')).toContain('Testziel in Austria');
  });

  it('englische Floskeln werden ebenso uebersprungen wie deutsche', () => {
    expect(firstUsefulSentence('Welcome to the Seeschloss Ort!', 'en')).toBe(null);
    expect(
      firstUsefulSentence('Welcome! The castle has stood on an island in Lake Traunsee since 1080.', 'en'),
    ).toBe('The castle has stood on an island in Lake Traunsee since 1080.');
  });
});
