/**
 * Site-Konfiguration (fn-31): Land und Domain stehen an einer Stelle.
 * Die Datei läuft in CI mit SITE_COUNTRY leer (Österreich) und mit DE.
 */
import { describe, it, expect } from 'vitest';
import { getSite, SITE_ORIGIN } from '@/lib/site';
import { SITES, parseSiteCountry, resolveOrigin } from '@/lib/site/sites';
import { SITE_COUNTRY } from '@/lib/site-country';
import { SITE_URL, deOnlyAlternates } from '@/lib/seo/canonical';
import { SITE_ORIGIN as URL_ORIGIN } from '@/lib/site-url';

describe('parseSiteCountry', () => {
  it('leer heißt Österreich', () => {
    expect(parseSiteCountry(undefined)).toBe('AT');
    expect(parseSiteCountry('')).toBe('AT');
    expect(parseSiteCountry('  ')).toBe('AT');
  });

  it('liest AT und DE unabhängig von Schreibweise und Rand', () => {
    expect(parseSiteCountry('AT')).toBe('AT');
    expect(parseSiteCountry('de')).toBe('DE');
    expect(parseSiteCountry(' DE ')).toBe('DE');
  });

  it('ein unbekanntes Land bricht ab statt still Österreich zu bauen', () => {
    expect(() => parseSiteCountry('CH')).toThrow(/SITE_COUNTRY/);
    expect(() => parseSiteCountry('Deutschland')).toThrow(/SITE_COUNTRY/);
  });
});

describe('SITES', () => {
  it('jede Seite trägt ihr eigenes Land, ihre Domain und passende Sprachangaben', () => {
    for (const [key, site] of Object.entries(SITES)) {
      expect(site.country).toBe(key);
      expect(site.url).toBe(`https://${site.domain}`);
      expect(site.url.endsWith('/')).toBe(false);
      expect(site.hreflang).toBe(`de-${site.country}`);
      expect(site.ogLocale).toBe(`de_${site.country}`);
      expect(site.locales[0]).toBe('de');
    }
    const domains = Object.values(SITES).map(s => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('Österreich bleibt, wie es war', () => {
    const { features, tagline, ...rest } = SITES.AT;
    expect(tagline).toContain('Österreich');
    expect(Object.values(features).every(Boolean)).toBe(true);
    expect(rest).toEqual({
      country: 'AT',
      domain: 'lasstreffen.at',
      url: 'https://lasstreffen.at',
      brand: 'LassTreffen.at',
      countryName: { de: 'Österreich', en: 'Austria' },
      hreflang: 'de-AT',
      ogLocale: 'de_AT',
      locales: ['de', 'en'],
      timeZone: 'Europe/Vienna',
      contact: { office: 'office@lasstreffen.at', support: 'support@lasstreffen.at' },
    });
  });
});

describe('resolveOrigin', () => {
  it('ohne gesetzte Adresse gilt die URL der Seite', () => {
    expect(resolveOrigin(SITES.AT, '')).toBe('https://lasstreffen.at');
    expect(resolveOrigin(SITES.DE, undefined)).toBe('https://lasstreffen.de');
  });

  it('eine gesetzte Adresse gilt, ohne Schrägstrich am Ende', () => {
    expect(resolveOrigin(SITES.AT, 'http://localhost:3000/')).toBe('http://localhost:3000');
    expect(resolveOrigin(SITES.AT, 'https://lasstreffen.at')).toBe('https://lasstreffen.at');
    expect(resolveOrigin(SITES.DE, 'https://www.lasstreffen.de')).toBe('https://www.lasstreffen.de');
  });

  it('die Adresse der anderen Seite bricht ab (DE-Image mit AT-Adresse)', () => {
    expect(() => resolveOrigin(SITES.DE, 'https://lasstreffen.at')).toThrow(/lasstreffen\.at/);
    expect(() => resolveOrigin(SITES.AT, 'https://www.lasstreffen.de')).toThrow(/lasstreffen\.de/);
  });

  it('eine Adresse ohne Schema bleibt wie bisher unverändert, die fremde Domain fällt trotzdem auf', () => {
    expect(resolveOrigin(SITES.AT, 'lasstreffen.at')).toBe('lasstreffen.at');
    expect(() => resolveOrigin(SITES.DE, 'lasstreffen.at:443/')).toThrow(/lasstreffen\.at/);
  });
});

describe('die Seite dieses Builds', () => {
  const expected = SITES[parseSiteCountry(process.env.SITE_COUNTRY)];

  it('getSite folgt SITE_COUNTRY', () => {
    expect(getSite()).toBe(expected);
  });

  it('Land, kanonische URL und Origin kommen aus der Site', () => {
    expect(SITE_COUNTRY).toBe(expected.country);
    expect(SITE_URL).toBe(expected.url);
    expect(deOnlyAlternates('/wien').canonical).toBe(`${expected.url}/wien`);
    expect(URL_ORIGIN).toBe(SITE_ORIGIN);
    if (!process.env.NEXT_PUBLIC_SITE_URL) expect(SITE_ORIGIN).toBe(expected.url);
  });
});
