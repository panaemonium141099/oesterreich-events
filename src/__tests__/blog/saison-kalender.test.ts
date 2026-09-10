import { describe, it, expect } from 'vitest';
import {
  SAISON_KALENDER, daysUntilDeadline, isDue, factsAreStale, FACTS_MAX_AGE_DAYS,
  type SaisonGuideSpec,
} from '@/content/blog/saison-kalender';

const spec = (over: Partial<SaisonGuideSpec> = {}): SaisonGuideSpec => ({
  liveBy: '09-20',
  leadDays: 14,
  slug: 'test',
  title: 'Test',
  subtitle: 'Test',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-slate-800 text-white',
  heroImage: '/images/categories/kultur-1.jpg',
  searchKeywords: ['test'],
  monthsAhead: [0, 2],
  categories: ['Kultur & Bühne'],
  bestandsPosts: [],
  ...over,
});

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('daysUntilDeadline', () => {
  it('zählt die Tage bis zur Frist im laufenden Jahr', () => {
    expect(daysUntilDeadline(spec({ liveBy: '09-20' }), at('2026-09-10'))).toBe(10);
  });

  it('ist am Stichtag selbst null', () => {
    expect(daysUntilDeadline(spec({ liveBy: '09-20' }), at('2026-09-20'))).toBe(0);
  });

  it('wird direkt nach der Frist negativ, damit Verspätung sichtbar bleibt', () => {
    expect(daysUntilDeadline(spec({ liveBy: '09-20' }), at('2026-09-25'))).toBe(-5);
  });

  it('rollt eine lange vergangene Frist aufs nächste Jahr, statt sie dauerhaft als überfällig zu führen', () => {
    // 20.02. ist am 10.09. seit über einem halben Jahr vorbei — gemeint ist
    // der Termin im Februar darauf, nicht der vergangene.
    expect(daysUntilDeadline(spec({ liveBy: '02-20' }), at('2026-09-10'))).toBe(163);
  });

  it('behandelt einen Jahreswechsel im Arbeitsfenster korrekt', () => {
    expect(daysUntilDeadline(spec({ liveBy: '01-10' }), at('2026-12-28'))).toBe(13);
  });
});

describe('isDue', () => {
  it('ist außerhalb des Vorlauffensters nicht fällig', () => {
    expect(isDue(spec({ liveBy: '09-20', leadDays: 14 }), at('2026-09-01'))).toBe(false);
  });

  it('wird fällig, sobald das Vorlauffenster beginnt', () => {
    expect(isDue(spec({ liveBy: '09-20', leadDays: 14 }), at('2026-09-06'))).toBe(true);
  });

  it('bleibt nach verpasster Frist fällig — die Seite fehlt ja weiterhin', () => {
    expect(isDue(spec({ liveBy: '09-20', leadDays: 14 }), at('2026-09-28'))).toBe(true);
  });
});

describe('factsAreStale', () => {
  it('gilt für Einträge ganz ohne Fakten nicht', () => {
    expect(factsAreStale(spec(), at('2026-09-10'))).toBe(false);
  });

  it('erkennt frisch geprüfte Fakten als gültig', () => {
    const s = spec({ facts: [{ label: 'Termin', value: 'x' }], factsVerified: '2026-09-01' });
    expect(factsAreStale(s, at('2026-09-10'))).toBe(false);
  });

  it('schlägt an, wenn die Prüfung zu lange her ist', () => {
    const s = spec({ facts: [{ label: 'Termin', value: 'x' }], factsVerified: '2025-09-01' });
    expect(factsAreStale(s, at('2026-09-10'))).toBe(true);
  });

  it('behandelt Fakten ohne Prüfdatum als ungeprüft', () => {
    const s = spec({ facts: [{ label: 'Termin', value: 'x' }] });
    expect(factsAreStale(s, at('2026-09-10'))).toBe(true);
  });

  it('greift genau ab FACTS_MAX_AGE_DAYS', () => {
    const verified = new Date(at('2026-09-10').getTime() - (FACTS_MAX_AGE_DAYS + 1) * 86_400_000);
    const s = spec({
      facts: [{ label: 'Termin', value: 'x' }],
      factsVerified: verified.toISOString().slice(0, 10),
    });
    expect(factsAreStale(s, at('2026-09-10'))).toBe(true);
  });
});

describe('SAISON_KALENDER', () => {
  it('hat eindeutige Slugs', () => {
    const slugs = SAISON_KALENDER.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('trägt überall eine gültige MM-TT-Frist', () => {
    for (const s of SAISON_KALENDER) {
      expect(s.liveBy, s.slug).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
      expect(s.leadDays, s.slug).toBeGreaterThan(0);
    }
  });

  it('führt zu jedem Fakten-Eintrag ein Prüfdatum und eine Primärquelle', () => {
    for (const s of SAISON_KALENDER.filter((x) => x.facts?.length)) {
      expect(s.factsVerified, s.slug).toBeTruthy();
      expect(s.sources?.length, s.slug).toBeGreaterThan(0);
    }
  });

  it('nutzt evergreen Slugs ohne Jahreszahl — sonst startet die Seite jedes Jahr ohne Autorität', () => {
    for (const s of SAISON_KALENDER) {
      expect(s.slug, s.slug).not.toMatch(/(19|20)\d{2}/);
    }
  });
});
