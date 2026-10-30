/**
 * DE-Adapter DPCalendar (fn-29.7), Golden-Tests auf echten iCal-Exporten
 * (abgerufen 2026-10-29): Weimar (Lahn) (`TZID=UTC` = Ortszeit), Masserberg
 * (`TZID=Europe/Berlin`), Bramstedtlund (Google-Spiegel, RRULE).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDpIcs } from '@/lib/scrapers/de/dpcalendar';
import { dpDetailUrl } from '@/lib/scrapers/de/DpCalendarDeScraper';
import { municipalServiceKind } from '@/lib/category-classifier/municipal-service';
import type { FeedGroup } from '@/lib/registry-de/load';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'dpcalendar', f), 'utf8');
const from = new Date('2026-10-29T00:00:00Z');
const to = new Date('2027-10-29T00:00:00Z');
const berlin = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

describe('DPCalendar: iCal lesen', () => {
  it('TZID=UTC ist die Ortszeit der Website (Weimar „Angst im Dunkeln", Seite 20:00 bis 21:30)', () => {
    const e = parseDpIcs(fx('weimar.ics'), from, to).find(x => x.title.startsWith('"Angst im Dunkeln"'))!;
    expect(berlin(e.start)).toBe('30.10.2026, 20:00:00');
    expect(berlin(e.end!)).toBe('30.10.2026, 21:30:00');
    expect(e.url).toMatch(/^https:\/\/www\.gemeinde-weimar\.de\//);
  });

  it('TZID=Europe/Berlin (Masserberg „Musikalische Abendandacht", Seite 31.10.2026 19:00)', () => {
    const e = parseDpIcs(fx('masserberg.ics'), from, to).find(x => x.title === 'Musikalische Abendandacht' && x.localDate === '2026-10-31')!;
    expect(berlin(e.start)).toBe('31.10.2026, 19:00:00');
  });

  it('Wiederholung aufgelöst: „Kirchspielarchiv" jeden Mittwoch 15:00 im Fenster, nichts vor dem Fenster', () => {
    const evs = parseDpIcs(fx('bramstedtlund.ics'), from, to).filter(x => x.title === 'Kirchspielarchiv');
    expect(evs.length).toBeGreaterThan(40);
    for (const e of evs) {
      expect(new Date(e.start).getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(berlin(e.start)).toMatch(/, 15:00:00$/);
      expect(new Date(e.start).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' })).toBe('Mittwoch');
    }
    expect(new Set(evs.map(e => e.localDate)).size).toBe(evs.length);
  });

  it('ganztägig: DTEND ausschließlich', () => {
    const allDay = parseDpIcs(fx('bramstedtlund.ics'), from, to).filter(x => x.allDay);
    expect(allDay.length).toBeGreaterThan(0);
    for (const e of allDay) {
      expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.end) expect(e.end > e.start).toBe(true);
    }
  });
});

describe('DPCalendar: Terminseite und Gemeinde-Dienst', () => {
  const g: FeedGroup = { feedUrl: 'https://www.poyenberg.de/index.php?option=com_dpcalendar&task=ical.download&id=20', pageUrl: 'https://www.poyenberg.de/kalender', own: [], viaVerband: [] };

  it('Link nur auf derselben Website, sonst die Kalenderseite (Poyenberg verlinkt den Veranstalter)', () => {
    expect(dpDetailUrl('http://www.irishfolk-poyenberg.de', g)).toBe('https://www.poyenberg.de/kalender');
    expect(dpDetailUrl('https://poyenberg.de/termine/x.html', g)).toBe('https://poyenberg.de/termine/x.html');
    expect(dpDetailUrl(undefined, g)).toBe('https://www.poyenberg.de/kalender');
  });

  it('Schließung der Verwaltung ist ein Gemeinde-Dienst, eine Veranstaltung im Rathaus nicht', () => {
    expect(municipalServiceKind('Meldeamt geschlossen')).toBe('office_closed');
    expect(municipalServiceKind('Standesamt geschlossen wegen Fortbildung')).toBe('office_closed');
    expect(municipalServiceKind('Geschlossene Gesellschaft im Rathaus')).toBeNull();
    expect(municipalServiceKind('Schwimmbad geschlossen')).toBeNull();
  });
});
