/**
 * DE-Adapter MEC (fn-29.7) und JSON-LD-Leser, Golden-Tests auf echten Seiten
 * (abgerufen 2026-10-29): Kalenderseite Dollerup, Kindenheim (Liste und
 * Detailseite des Abgabebasars).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ldEventsFromHtml, toLdEvent } from '@/lib/scrapers/de/jsonld';
import { collapseRunningRepeats, mecShownTime, withShownTime } from '@/lib/scrapers/de/MecDeScraper';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'mec', f), 'utf8');
const berlin = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

describe('JSON-LD lesen', () => {
  it('Kalenderseite Dollerup: Termine mit Detailseite, Ortsname, Wandzeit', () => {
    const evs = ldEventsFromHtml(fx('dollerup-termine.html'));
    expect(evs.length).toBeGreaterThan(10);
    const l = evs.find(e => e.url?.endsWith('/laterne-laufen-und-punschen/'))!;
    expect(berlin(l.start)).toBe('6.11.2026, 18:00:00');
    // Ende 00:00 des Folgetags ist das Tagesende, keine Uhrzeit.
    expect(l.end).toBeUndefined();
    expect(l.locationName).toBe('Grabstr. 7');
  });

  it('Versatz zählt nicht, die Wandzeit schon (fester „+01:00" im Sommer)', () => {
    const e = toLdEvent({ '@type': 'Event', name: 'Sommerfest', startDate: '2027-07-03T15:00:00+01:00', endDate: '2027-07-03T22:00:00+01:00' })!;
    expect(berlin(e.start)).toBe('3.7.2027, 15:00:00');
    expect(berlin(e.end!)).toBe('3.7.2027, 22:00:00');
  });

  it('reines Datum ganztägig, abgesagt verworfen, Bild als ImageObject mit Maßen', () => {
    expect(toLdEvent({ '@type': 'Event', name: 'Markt', startDate: '2026-11-28', endDate: '2026-11-29' })).toMatchObject({ allDay: true, start: '2026-11-28', end: '2026-11-29' });
    expect(toLdEvent({ '@type': 'Event', name: 'X', startDate: '2026-11-28', eventStatus: 'https://schema.org/EventCancelled' })).toBeNull();
    expect(toLdEvent({ '@type': 'Event', name: 'X', startDate: '2026-11-28', image: { '@type': 'ImageObject', url: 'https://a.de/b.jpg', width: 800, height: 600 } }))
      .toMatchObject({ image: 'https://a.de/b.jpg', imageWidth: 800, imageHeight: 600 });
  });
});

describe('MEC: Liste gegen Detailseite (Kindenheim „Abgabebasar", Anzeige „30 Okt. 2026 Ganztags")', () => {
  it('die Liste verschiebt den ganztägigen Termin auf den 29., die Detailseite hat den 30.', () => {
    const name = 'Abgabebasar rund ums Kind Hebst/Winter KiTa-Förderverein';
    const list = ldEventsFromHtml(fx('kindenheim-liste.html')).find(e => e.name === name)!;
    const detail = ldEventsFromHtml(fx('kindenheim-detail.html')).find(e => e.name === name)!;
    expect(list.localDate).toBe('2026-10-29');
    expect(detail).toMatchObject({ allDay: true, localDate: '2026-10-30' });
  });
});

describe('MEC: laufende Termine in der Monatsansicht', () => {
  it('derselbe mehrtägige Termin an jedem Tag der Ansicht ist ein Termin (Zella-Mehlis „Zwei Generationen")', () => {
    const base = { name: 'Zwei Generationen', url: 'https://x.de/events/zwei/', end: '2027-04-30', allDay: true };
    const evs = ['2026-10-29', '2026-10-30', '2026-10-31'].map(d => ({ ...base, localDate: d, start: d }));
    const serie = ['2026-11-04', '2026-11-11'].map(d => ({ name: 'Gymnastik', url: 'https://x.de/events/gym/', localDate: d, start: d, allDay: true }));
    const out = collapseRunningRepeats([...evs, ...serie]);
    expect(out.filter(e => e.name === 'Zwei Generationen').map(e => e.localDate)).toEqual(['2026-10-29']);
    expect(out.filter(e => e.name === 'Gymnastik')).toHaveLength(2);
  });
});

describe('MEC: Abnahme fn-29.20 (Dorffest-Stichprobe, abgerufen 2026-11-03)', () => {
  it('Pegau: der laufende Markt am zweiten Tag ohne Ende ist derselbe Termin', () => {
    const evs = ldEventsFromHtml(fx('pegau-liste-auszug.html')).filter(e => e.name === 'Pegauer Weihnachtsmarkt & Adventsmesse');
    expect(evs.map(e => e.localDate)).toEqual(['2026-11-28', '2026-11-29']);
    const out = collapseRunningRepeats(evs);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ localDate: '2026-11-28', end: '2026-11-29', allDay: true });
  });

  it('Hohen Viecheln: Detailseite zeigt 14:00 bis 18:00, das JSON-LD sagt 15:00; die Anzeige gilt', () => {
    const html = fx('hohen-viecheln-detail.html');
    const ld = ldEventsFromHtml(html).find(e => e.name === 'Adventsmarkt in Hohen Viecheln')!;
    expect(berlin(ld.start)).toBe('28.11.2026, 15:00:00');
    expect(mecShownTime(html)).toEqual({ start: '14:00:00', end: '18:00:00' });
    const e = withShownTime(ld, mecShownTime(html));
    expect(berlin(e.start)).toBe('28.11.2026, 14:00:00');
    expect(berlin(e.end!)).toBe('28.11.2026, 18:00:00');
  });

  it('ohne angezeigte Uhrzeit, ganztägig oder mehrtägig bleibt der Termin, wie er ist', () => {
    const e = toLdEvent({ '@type': 'Event', name: 'Markt', startDate: '2026-11-28T10:00:00+01:00', endDate: '2026-11-29T18:00:00+01:00' })!;
    expect(withShownTime(e, { start: '14:00:00' })).toBe(e);
    const day = toLdEvent({ '@type': 'Event', name: 'Markt', startDate: '2026-11-28' })!;
    expect(withShownTime(day, { start: '14:00:00' })).toBe(day);
    expect(mecShownTime('<div class="mec-single-event-time"><dd><abbr class="mec-events-abbr">Ganztägig</abbr></dd></div>')).toBeNull();
  });
});
