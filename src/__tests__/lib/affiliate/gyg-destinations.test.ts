/**
 * fn-22 — Zielorte + Zielseiten-Links.
 *
 * Kern der Tests: die Box darf nur dort erscheinen, wo GYG nachweislich
 * Angebot hat, und nie ohne Attribution verlinken.
 */
import { describe, it, expect } from 'vitest';
import {
  GYG_CITIES,
  GYG_REGIONS,
  findGygCity,
  findGygRegion,
  gygKey,
  resolveGygDestination,
} from '@/lib/affiliate/gyg-destinations';
import { buildGygDestinationLink, isGygDestinationEnabled } from '@/lib/affiliate/gyg-links';

const ENV_ON = {
  NEXT_PUBLIC_GYG_ENABLED: 'true',
  NEXT_PUBLIC_GYG_PARTNER_ID: 'PARTNER1',
};

describe('gygKey', () => {
  it('faltet Umlaute in beiden Schreibweisen auf denselben Schluessel', () => {
    expect(gygKey('Sölden')).toBe(gygKey('Soelden'));
    expect(gygKey('Kärnten')).toBe(gygKey('kaernten'));
    expect(gygKey('Kitzbühel')).toBe(gygKey('Kitzbuehel'));
  });

  it('ignoriert Satzzeichen und Leerzeichen', () => {
    expect(gygKey('Zell am See')).toBe('zellamsee');
    expect(gygKey('Saalbach-Hinterglemm')).toBe('saalbachhinterglemm');
  });
});

describe('Datenbestand', () => {
  it('enthaelt keinen Ort ohne Angebot — leere Zielseiten bleiben draussen', () => {
    for (const dest of [...GYG_CITIES, ...Object.values(GYG_REGIONS)]) {
      expect(dest.activities, dest.name).toBeGreaterThan(0);
    }
  });

  it('deckt alle neun Bundeslaender ab, damit der Fallback nie ins Leere laeuft', () => {
    const bundeslaender = [
      'Burgenland',
      'Kärnten',
      'Niederösterreich',
      'Oberösterreich',
      'Salzburg',
      'Steiermark',
      'Tirol',
      'Vorarlberg',
      'Wien',
    ];
    for (const bl of bundeslaender) expect(findGygRegion(bl), bl).not.toBeNull();
  });

  it('erkennt auch die Slug-Schreibweise aus getBundeslandFromPLZ', () => {
    expect(findGygRegion('niederoesterreich')?.path).toBe('niederosterreich-l2387');
    expect(findGygRegion('kaernten')?.path).toBe('karnten-l256');
  });
});

describe('findGygCity', () => {
  it('findet Orte inklusive Alias-Schreibweisen', () => {
    expect(findGygCity('Wien')?.path).toBe('wien-l7');
    expect(findGygCity('Klagenfurt am Wörthersee')?.path).toBe('klagenfurt-l3');
    expect(findGygCity('Krems')?.path).toBe('krems-an-der-donau-l154016');
    expect(findGygCity('Hinterglemm')?.path).toBe('saalbach-hinterglemm-l156448');
  });

  it('matcht nur exakt — "Wiener Neustadt" ist nicht Wien', () => {
    expect(findGygCity('Wiener Neustadt')).toBeNull();
    expect(findGygCity('Sankt Salzburg')).toBeNull();
    expect(findGygCity('')).toBeNull();
    expect(findGygCity(null)).toBeNull();
  });
});

describe('resolveGygDestination', () => {
  it('nimmt den Ort vor dem Bundesland', () => {
    const dest = resolveGygDestination({ city: 'Graz', bundesland: 'Steiermark' });
    expect(dest?.path).toBe('graz-l32599');
  });

  it('liest den Ort aus einer Adresse mit PLZ', () => {
    const dest = resolveGygDestination({ address: 'Herrengasse 16, 8010 Graz, Steiermark' });
    expect(dest?.path).toBe('graz-l32599');
  });

  it('faellt auf das Bundesland zurueck, wenn der Ort kein GYG-Ziel ist', () => {
    const dest = resolveGygDestination({ city: 'Pinkafeld', bundesland: 'Burgenland' });
    expect(dest?.kind).toBe('region');
    expect(dest?.path).toBe('burgenland-l215');
  });

  it('liefert null, wenn weder Ort noch Bundesland etwas hergeben', () => {
    expect(resolveGygDestination({ city: 'Pinkafeld' })).toBeNull();
    expect(resolveGygDestination({})).toBeNull();
    expect(resolveGygDestination({ bundesland: 'Bayern' })).toBeNull();
  });
});

describe('buildGygDestinationLink', () => {
  const dest = { path: 'wien-l7' };

  it('liefert null, solange Flag oder partner_id fehlen', () => {
    expect(isGygDestinationEnabled({})).toBe(false);
    expect(buildGygDestinationLink(dest, { placement: 'event-1', env: {} })).toBeNull();
    expect(
      buildGygDestinationLink(dest, {
        placement: 'event-1',
        env: { NEXT_PUBLIC_GYG_ENABLED: 'true' },
      }),
    ).toBeNull();
  });

  it('setzt partner_id und Platzierung', () => {
    const url = new URL(
      buildGygDestinationLink(dest, { placement: 'event-1a2b3c4d', env: ENV_ON })!,
    );
    expect(url.origin + url.pathname).toBe('https://www.getyourguide.de/wien-l7/');
    expect(url.searchParams.get('partner_id')).toBe('PARTNER1');
    expect(url.searchParams.get('cmp')).toBe('event-1a2b3c4d');
  });

  it('nutzt fuer /en die .com-Seite', () => {
    const url = buildGygDestinationLink(dest, {
      placement: 'gemeinde-wien',
      locale: 'en',
      env: ENV_ON,
    })!;
    expect(url.startsWith('https://www.getyourguide.com/wien-l7/')).toBe(true);
  });

  it('entschaerft Sonderzeichen in der Platzierung', () => {
    const url = new URL(
      buildGygDestinationLink(dest, { placement: 'blog-wien/fest?x=1', env: ENV_ON })!,
    );
    expect(url.searchParams.get('cmp')).toBe('blog-wien-fest-x-1');
  });

  it('respektiert einen abweichenden Kampagnen-Parameter aus der Env', () => {
    const url = new URL(
      buildGygDestinationLink(dest, {
        placement: 'event-1',
        env: { ...ENV_ON, NEXT_PUBLIC_GYG_CAMPAIGN_PARAM: 'utm_campaign' },
      })!,
    );
    expect(url.searchParams.get('utm_campaign')).toBe('event-1');
    expect(url.searchParams.get('cmp')).toBeNull();
  });
});
