/**
 * Themen von /was-tun/[slug]/[thema]: jede Zeile ergibt für jeden Ort eine
 * Seite, und ihre Filter sind genau die Parameter, mit denen der Browser
 * über /api/events und /api/activities nachlädt.
 */
import { describe, it, expect } from 'vitest';
import { themeFilters, WAS_TUN_THEMES, wasTunThemeBySlug } from '@/lib/was-tun/themes';
import {
  buildAnswer,
  buildWasTunFaq,
  buildWasTunJsonLd,
  buildWasTunMeta,
  wasTunCanonicalUrl,
  wasTunQuestion,
} from '@/lib/was-tun/content';
import { resolveWasTunPlace, wasTunHref } from '@/lib/was-tun/places';
import { TOURISM_REGIONS } from '@/lib/was-tun/regions';
import { getGemeindeBySlug } from '@/lib/gemeinden/data';

/** Parameter, die loaders.ts und die APIs beide auswerten. */
const EVENT_PARAMS = new Set(['categories', 'dateFrom', 'dateTo', 'priceTier']);
const ACTIVITY_PARAMS = new Set(['setting']);

const lofer = resolveWasTunPlace('5090-lofer')!;
const regen = wasTunThemeBySlug('bei-regen')!;
const kinder = wasTunThemeBySlug('mit-kindern')!;

describe('Themenliste', () => {
  it('Slugs sind eindeutig, URL-tauglich und kollidieren mit keinem Ort', () => {
    const slugs = WAS_TUN_THEMES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z][a-z-]*$/);
      expect(resolveWasTunPlace(s)).toBeNull();
      expect(getGemeindeBySlug(s)).toBeNull();
      expect(TOURISM_REGIONS.some((r) => r.slug === s)).toBe(false);
    }
  });

  it('jedes Thema zeigt mindestens eine Art und nutzt nur Parameter, die Server und API kennen', () => {
    for (const t of WAS_TUN_THEMES) {
      const f = themeFilters(t, '2026-11-18');
      expect([t.slug, f.events !== null || f.activities !== null]).toEqual([t.slug, true]);
      for (const k of Object.keys(f.events ?? {})) expect([t.slug, k, EVENT_PARAMS.has(k)]).toEqual([t.slug, k, true]);
      for (const k of Object.keys(f.activities ?? {})) expect([t.slug, k, ACTIVITY_PARAMS.has(k)]).toEqual([t.slug, k, true]);
    }
  });

  it('jedes Thema sagt in einem Satz ohne Striche, woran es die Auswahl festmacht', () => {
    for (const t of WAS_TUN_THEMES) {
      expect(t.note).toMatch(/^Gezeigt werden .+\.$/);
      expect(t.note).not.toMatch(/[–—]| - /);
    }
  });

  it('ohne Thema gibt es keine Filter, aber beide Arten', () => {
    expect(themeFilters(null)).toEqual({ events: {}, activities: {} });
  });
});

describe('Filter je Thema', () => {
  it('heute und am Wochenende rechnen mit dem Wiener Tag', () => {
    // 18.11.2026 ist ein Mittwoch.
    expect(themeFilters(wasTunThemeBySlug('heute'), '2026-11-18').events).toEqual({ dateFrom: '2026-11-18', dateTo: '2026-11-18' });
    expect(themeFilters(wasTunThemeBySlug('am-wochenende'), '2026-11-18').events).toEqual({ dateFrom: '2026-11-21', dateTo: '2026-11-22' });
    // Am Sonntag gilt das laufende Wochenende, nicht das nächste.
    expect(themeFilters(wasTunThemeBySlug('am-wochenende'), '2026-11-22').events).toEqual({ dateFrom: '2026-11-21', dateTo: '2026-11-22' });
  });

  it('bei Regen: Ausflugsziele drinnen, Events aus Kultur und Bühne', () => {
    expect(themeFilters(regen)).toEqual({ events: { categories: 'Kultur & Bühne' }, activities: { setting: 'indoor' } });
  });

  it('mit Kindern und kostenlos zeigen nur Veranstaltungen', () => {
    expect(themeFilters(kinder)).toEqual({ events: { categories: 'Familie & Kinder' }, activities: null });
    expect(themeFilters(wasTunThemeBySlug('kostenlos'))).toEqual({ events: { priceTier: 'gratis' }, activities: null });
  });
});

describe('Texte einer Themenseite', () => {
  const totals = { events: 12, activities: 8 };

  it('Frage, Adresse und Canonical tragen das Thema', () => {
    expect(wasTunQuestion(lofer, regen)).toBe('Was kann man in Lofer bei Regen machen?');
    expect(wasTunHref('5090-lofer', 'bei-regen')).toBe('/was-tun/5090-lofer/bei-regen');
    expect(wasTunCanonicalUrl('5090-lofer', regen)).toMatch(/\/was-tun\/5090-lofer\/bei-regen$/);
    expect(buildWasTunMeta(lofer, totals, regen).title).toContain('Was kann man in Lofer bei Regen machen?');
  });

  it('die Antwort nennt Bestand und Auswahlregel', () => {
    expect(buildAnswer(lofer, totals, [], regen)).toBe(
      'In Lofer gibt es bei Regen 12 Veranstaltungen und 8 Ausflugsziele und Freizeitaktivitäten. ' +
      'Gezeigt werden Ausflugsziele, die drinnen liegen, und Veranstaltungen aus Kultur und Bühne.',
    );
    expect(buildAnswer(lofer, { events: 0, activities: 0 }, [], kinder)).toBe(
      'In Lofer ist mit Kindern aktuell nichts eingetragen. Gezeigt werden Veranstaltungen der Kategorie Familie und Kinder.',
    );
  });

  it('FAQ fragt mit dem Thema, die Grundseite bleibt unverändert', () => {
    const ev = [{ id: '1', title: 'Kasperl', slug: 'kasperl', start_date: '2026-11-22T14:00:00Z', location_name: null, category: 'Familie & Kinder', image_url: null, event_score: 1 }];
    expect(buildWasTunFaq(lofer, { events: 1, activities: 0 }, ev, [], kinder).map((f) => f.question)).toEqual([
      'Was kann man in Lofer mit Kindern machen?',
      'Welche Veranstaltungen gibt es in Lofer mit Kindern?',
    ]);
    expect(buildWasTunFaq(lofer, { events: 1, activities: 0 }, ev, []).map((f) => f.question)).toEqual([
      'Was kann man in Lofer machen?',
      'Welche Veranstaltungen gibt es demnächst in Lofer?',
    ]);
  });

  it('Brotkrumen führen über die Grundseite des Orts zum Thema', () => {
    const graph = JSON.parse(buildWasTunJsonLd(lofer, totals, [], [], regen))['@graph'];
    const crumbs = graph[0].itemListElement;
    expect(crumbs.map((c: { name: string }) => c.name)).toEqual(['Home', 'Was tun', 'Salzburg', 'Lofer', 'Bei Regen']);
    expect(crumbs[3].item).toMatch(/\/was-tun\/5090-lofer$/);
    expect(crumbs[4].item).toMatch(/\/was-tun\/5090-lofer\/bei-regen$/);
  });
});
