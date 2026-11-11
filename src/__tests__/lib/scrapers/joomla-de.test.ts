/**
 * DE-Adapter JEvents und iCagenda (fn-29.7), Golden-Tests auf echten Seiten
 * (abgerufen 2026-10-29): Schönwalde am Bungsberg und Sönnebüll (JEvents),
 * Immenstedt (iCagenda).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jeventsTermin, parseICagendaDetail, parseJEventsDetail, parseJEventsTitle, rssItems } from '@/lib/scrapers/de/joomla';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'joomla', f), 'utf8');
const berlin = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

describe('JEvents', () => {
  it('RSS: Datum und Uhrzeit im Titel', () => {
    const items = rssItems(fx('jevents-schoenwalde-rss.xml'));
    expect(items.length).toBeGreaterThan(0);
    expect(parseJEventsTitle('02.11.2026 09:30 Uhr : Bewegung im Alter')).toEqual({ date: '2026-11-02', time: '09:30', title: 'Bewegung im Alter' });
    expect(parseJEventsTitle('29.10.2026 : Müllabfuhr: braune Tonne')).toEqual({ date: '2026-10-29', time: undefined, title: 'Müllabfuhr: braune Tonne' });
  });

  it('Detailseite: „Montag, 02. November 2026, 09:30 Uhr - 10:30 Uhr" gibt Beginn und Ende', () => {
    const link = 'https://www.schoenwalde-am-bungsberg.com/index.php/termine/eventdetail/944/31/bewegung-im-alter';
    const t = jeventsTermin({ title: '02.11.2026 09:30 Uhr : Bewegung im Alter', link }, parseJEventsDetail(fx('jevents-schoenwalde.html')))!;
    expect(t).toMatchObject({ title: 'Bewegung im Alter', url: link, localDate: '2026-11-02', allDay: false });
    expect(berlin(t.start)).toBe('2.11.2026, 09:30:00');
    expect(berlin(t.end!)).toBe('2.11.2026, 10:30:00');
  });

  it('ohne Uhrzeit ganztägig (Sönnebüll „Müllabfuhr: braune Tonne", Gemeinde-Dienst)', () => {
    const d = parseJEventsDetail(fx('jevents-soennebuell.html'));
    expect(d?.dates).toEqual(['2026-10-29']);
    const t = jeventsTermin({ title: '29.10.2026 : Müllabfuhr: braune Tonne', link: 'https://www.soennebuell.de/x' }, d)!;
    expect(t).toMatchObject({ allDay: true, start: '2026-10-29' });
  });
});

describe('iCagenda', () => {
  it('Detailseite: alle Daten mit Uhrzeit, Veranstaltungsort (Immenstedt „Spielenachmittag")', () => {
    const url = 'https://www.immenstedt.de/de/termine/153-spielenachmittag-des-sozialverbandes';
    const ts = parseICagendaDetail(fx('icagenda-immenstedt.html'), url);
    expect(ts.length).toBeGreaterThan(5);
    const nov = ts.find(t => t.localDate === '2026-11-03')!;
    expect(nov).toMatchObject({ title: 'Spielenachmittag des Sozialverbandes', locationName: 'Dörpshuus Immenstedt', url, allDay: false });
    expect(berlin(nov.start)).toBe('3.11.2026, 14:00:00');
    expect(new Set(ts.map(t => t.localDate)).size).toBe(ts.length);
  });
});
