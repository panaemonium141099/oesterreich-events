import { describe, it, expect } from 'vitest';
import {
  wrapBookingAffiliate,
  buildStaySearchUrl,
  buildAffiliateStayLink,
  deriveCityFromLocation,
} from '../affiliate';

describe('wrapBookingAffiliate', () => {
  it('packt die Ziel-URL in den CJ-Klick mit PID+Link-ID und sid', () => {
    const url = wrapBookingAffiliate('https://www.booking.com/searchresults.html?ss=Wien', 'blog-test');
    expect(url).toMatch(/^https:\/\/www\.kqzyfj\.com\/click-101870737-14082404\?/);
    expect(url).toContain('sid=blog-test');
    expect(url).toContain(`url=${encodeURIComponent('https://www.booking.com/searchresults.html?ss=Wien')}`);
  });

  it('säubert sid von URL-feindlichen Zeichen und kappt auf 60', () => {
    const url = wrapBookingAffiliate('https://www.booking.com', 'blog/ä?<script>' + 'x'.repeat(80));
    const sid = new URL(url).searchParams.get('sid')!;
    expect(sid).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(sid.length).toBeLessThanOrEqual(60);
  });
});

describe('buildStaySearchUrl', () => {
  it('baut Stadt+Datum-Suche mit checkout = checkin + nights', () => {
    const url = new URL(buildStaySearchUrl({ ss: 'Eisenstadt', checkin: '2026-09-04', nights: 2 }));
    expect(url.searchParams.get('ss')).toBe('Eisenstadt');
    expect(url.searchParams.get('checkin')).toBe('2026-09-04');
    expect(url.searchParams.get('checkout')).toBe('2026-09-06');
    expect(url.searchParams.get('group_adults')).toBe('2');
  });

  it('lässt Datum weg wenn kein valides checkin (Evergreen-Link)', () => {
    const url = new URL(buildStaySearchUrl({ ss: 'Graz', checkin: null }));
    expect(url.searchParams.get('ss')).toBe('Graz');
    expect(url.searchParams.has('checkin')).toBe(false);
    expect(url.searchParams.has('checkout')).toBe(false);
  });

  it('Monatsübergang beim checkout', () => {
    const url = new URL(buildStaySearchUrl({ ss: 'Wien', checkin: '2026-08-31' }));
    expect(url.searchParams.get('checkout')).toBe('2026-09-01');
  });
});

describe('buildAffiliateStayLink', () => {
  it('liefert CJ-Klick dessen url-Param die Booking-Suche trägt', () => {
    const link = buildAffiliateStayLink({ ss: 'Kitzbühel', checkin: '2026-09-05' }, 'plan');
    const inner = new URL(new URL(link).searchParams.get('url')!);
    expect(inner.hostname).toBe('www.booking.com');
    expect(inner.searchParams.get('ss')).toBe('Kitzbühel');
  });
});

describe('deriveCityFromLocation', () => {
  it.each([
    ['Schloss Esterhazy, Eisenstadt', 'Eisenstadt'],
    ['Kärntner Messen, Messeplatz 1, 9020 Klagenfurt am Wörthersee', 'Klagenfurt am Wörthersee'],
    ['Wien, Österreich', 'Wien'],
    ['Freiluftarena B', 'Freiluftarena B'],
    // PLZ+Stadt gewinnt vor allem anderen (Bug: "Übernachten in Theaterplatz 7")
    ['Theaterplatz 7, 2500 Baden, Niederösterreich', 'Baden'],
    // Straße als letzter Teil wird übersprungen, Stadt steht vorn
    ['Baden, Theaterplatz 7', 'Baden'],
    // Nur Straße+Hausnummer → nichts Stadtartiges → null (Box entfällt)
    ['Theaterplatz 7', null],
    ['', null],
    [null, null],
    ['1010', null],
  ])('%s → %s', (input, expected) => {
    expect(deriveCityFromLocation(input)).toBe(expected);
  });
});
