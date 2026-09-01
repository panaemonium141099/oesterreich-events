import { describe, it, expect } from 'vitest';
import {
  buildActivityTitle,
  buildActivityDescription,
  firstUsefulSentence,
  activityTypeLabel,
} from '../activity-meta';

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
    const t = buildActivityTitle({ name: 'Seeschloss Ort', town: 'Gmunden', openingTimes: { mo: '9-17' } });
    expect(t).toBe('Seeschloss Ort in Gmunden — Öffnungszeiten & Anfahrt');
    expect(t.length).toBeLessThanOrEqual(60);
  });

  it('fällt ohne Öffnungszeiten auf ein kürzeres Suffix zurück', () => {
    expect(buildActivityTitle({ name: 'Nothklamm', town: 'Landl' }))
      .toBe('Nothklamm in Landl — Infos & Anfahrt');
  });

  it('lässt Suffixe weg, wenn der Name schon lang ist', () => {
    const t = buildActivityTitle({
      name: 'Museum HochQuellenWasser mit Sonderausstellung',
      town: 'Wildalpen',
    });
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.startsWith('Museum HochQuellenWasser')).toBe(true);
  });

  it('nimmt das Bundesland, wenn kein Ort bekannt ist', () => {
    expect(buildActivityTitle({ name: 'Wanderweg', bundeslandName: 'Tirol' }))
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
    });
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
    });
    expect(d).toContain('Klammwanderung');
    expect(d.length).toBeLessThanOrEqual(158);
  });

  it('kommt ohne Tags und ohne Text aus', () => {
    const d = buildActivityDescription({ name: 'escape house Vorchdorf', town: 'Vorchdorf im Almtal' });
    expect(d).toContain('escape house Vorchdorf in Vorchdorf im Almtal');
    expect(d.length).toBeGreaterThan(40);
  });

  it('haelt die Laenge auch bei sehr langen Quelltexten ein', () => {
    const d = buildActivityDescription({
      name: 'Forstmuseum Silvanum',
      town: 'Landl',
      tags: ['museumstour'],
      description: 'In Großreifling steht das Silvanum. '.repeat(20),
    });
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
