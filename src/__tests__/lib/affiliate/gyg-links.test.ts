/**
 * GYG-Helper (fn-18 Task 5) — bewusst NUR Geruest hinter Feature-Flag.
 *
 * Diese Tests halten fest, dass ohne verifizierte Konfiguration NICHTS
 * gebaut wird: kein geratenes Template, kein Link ohne partner_id.
 * KEIN Acceptance-Kriterium haengt an GYG (Konto/Format unverifiziert).
 */
import { describe, it, expect } from 'vitest';
import { buildGygDeeplink, isGygEnabled } from '@/lib/affiliate/gyg-links';

const TEMPLATE = 'https://www.getyourguide.com/s/?q={query}';

describe('isGygEnabled', () => {
  it('ist false, solange Flag, partner_id oder Template fehlen', () => {
    expect(isGygEnabled({})).toBe(false);
    expect(isGygEnabled({ NEXT_PUBLIC_GYG_ENABLED: 'true' })).toBe(false);
    expect(
      isGygEnabled({ NEXT_PUBLIC_GYG_ENABLED: 'true', NEXT_PUBLIC_GYG_PARTNER_ID: 'X' }),
    ).toBe(false);
  });

  it('ist true nur mit Flag + partner_id + Template', () => {
    expect(
      isGygEnabled({
        NEXT_PUBLIC_GYG_ENABLED: 'true',
        NEXT_PUBLIC_GYG_PARTNER_ID: 'X',
        GYG_DEEPLINK_TEMPLATE: TEMPLATE,
      }),
    ).toBe(true);
  });
});

describe('buildGygDeeplink', () => {
  it('liefert null, solange das Flag aus ist (Default)', () => {
    expect(buildGygDeeplink({ query: 'Rafting', town: 'Imst' })).toBeNull();
  });

  it('liefert null ohne partner_id oder ohne Template — nie ein geratener Link', () => {
    expect(buildGygDeeplink({ query: 'Rafting', enabled: true, template: TEMPLATE })).toBeNull();
    expect(buildGygDeeplink({ query: 'Rafting', enabled: true, partnerId: 'X' })).toBeNull();
  });

  it('liefert null bei Template ohne {query}-Platzhalter', () => {
    expect(
      buildGygDeeplink({
        query: 'Rafting',
        enabled: true,
        partnerId: 'X',
        template: 'https://www.getyourguide.com/s/',
      }),
    ).toBeNull();
  });

  it('baut den Link erst mit vollstaendiger, verifizierter Konfiguration', () => {
    const url = buildGygDeeplink({
      query: 'Rafting',
      town: 'Imst',
      enabled: true,
      partnerId: 'PARTNER1',
      template: TEMPLATE,
    });
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.searchParams.get('q')).toBe('Rafting Imst');
    expect(parsed.searchParams.get('partner_id')).toBe('PARTNER1');
  });
});
